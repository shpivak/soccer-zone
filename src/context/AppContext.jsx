import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { APP_CONFIG } from '../config'
import { AppContext } from './appContextInstance'
import { getDefaultLeagueData } from '../utils/defaultData'
import {
  deleteLeague,
  getActiveLeague,
  isResetAllowed,
  loadDatasetData,
  saveLeagues,
  savePlayers,
  saveTournaments,
  setActiveLeague as persistActiveLeague,
} from '../utils/dataService'
import { LEAGUE_TYPES } from '../utils/leagueUtils'
import { DEFAULT_DATASET, isSupabaseConfigured } from '../utils/storageConfig'

export const AppProvider = ({ children }) => {
  const activeDataset = DEFAULT_DATASET
  const [activeLeagueId, setActiveLeagueId] = useState(getActiveLeague())
  const [leagues, setLeagues] = useState([])
  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const loadedDatasetRef = useRef('')
  const loadRequestIdRef = useRef(0)
  const dataRevisionRef = useRef(0)
  const leaguesRef = useRef(leagues)
  const playersRef = useRef(players)
  const tournamentsRef = useRef(tournaments)
  const supabaseSaveChainRef = useRef(Promise.resolve())

  const markDataDirty = () => {
    dataRevisionRef.current += 1
  }

  useEffect(() => {
    leaguesRef.current = leagues
    playersRef.current = players
    tournamentsRef.current = tournaments
  })

  const loadData = useCallback(async (dataset) => {
    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId
    const revisionAtStart = dataRevisionRef.current
    setIsLoading(true)
    setError('')
    try {
      const data = await loadDatasetData(dataset)
      const isStaleRequest = requestId !== loadRequestIdRef.current
      const dataChangedSinceLoadStarted = revisionAtStart !== dataRevisionRef.current
      if (isStaleRequest || dataChangedSinceLoadStarted) return
      setLeagues(data.leagues)
      setPlayers(data.players)
      setTournaments(data.tournaments)
      loadedDatasetRef.current = dataset
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const changeLeague = useCallback((leagueId) => {
    setActiveLeagueId(leagueId)
    persistActiveLeague(leagueId)
  }, [])

  const updateLeagues = useCallback((updater) => {
    markDataDirty()
    setLeagues(updater)
  }, [])

  const updatePlayers = useCallback((updater) => {
    markDataDirty()
    setPlayers(updater)
  }, [])

  const updateTournaments = useCallback((updater) => {
    markDataDirty()
    setTournaments(updater)
  }, [])

  useEffect(() => {
    loadData(DEFAULT_DATASET)
  }, [loadData])

  useEffect(() => {
    if (loadedDatasetRef.current !== DEFAULT_DATASET) return
 
    const flushLocal = () => {
      const L = leaguesRef.current
      const P = playersRef.current
      const T = tournamentsRef.current
      saveLeagues(DEFAULT_DATASET, L).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : 'Failed to save leagues')
      })
      savePlayers(DEFAULT_DATASET, P).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : 'Failed to save players')
      })
      saveTournaments(DEFAULT_DATASET, T).catch((saveError) => {
        setError(saveError instanceof Error ? saveError.message : 'Failed to save tournaments')
      })
    }

    if (!isSupabaseConfigured()) {
      flushLocal()
      return
    }

    const timer = window.setTimeout(() => {
      supabaseSaveChainRef.current = supabaseSaveChainRef.current
        .then(async () => {
          const L = leaguesRef.current
          const P = playersRef.current
          const T = tournamentsRef.current
          await saveLeagues(DEFAULT_DATASET, L)
          await savePlayers(DEFAULT_DATASET, P)
          await saveTournaments(DEFAULT_DATASET, T)
        })
        .catch((saveError) => {
          setError(saveError instanceof Error ? saveError.message : 'Failed to save data')
        })
    }, 300)

    return () => window.clearTimeout(timer)
  }, [leagues, players, tournaments])

  useEffect(() => {
    if (leagues.length === 0) return
    if (leagues.some((league) => league.id === activeLeagueId)) return
    const nextLeagueId = leagues[0]?.id
    if (nextLeagueId) {
      setActiveLeagueId(nextLeagueId)
      persistActiveLeague(nextLeagueId)
    }
  }, [activeLeagueId, leagues])

  const value = useMemo(
    () => ({
      activeDataset,
      activeLeagueId,
      error,
      isLoading,
      isResetEnabled: isResetAllowed(activeDataset),
      leagues,
      players,
      tournaments,
      setLeagues: updateLeagues,
      setPlayers: updatePlayers,
      setTournaments: updateTournaments,
      setActiveLeagueId: changeLeague,
      createLeague: ({ name, type }) => {
        const trimmed = name?.trim() ?? ''
        const safeType = Object.values(LEAGUE_TYPES).includes(type) ? type : LEAGUE_TYPES.tournament
        const id = `league-${Date.now()}`
        const newLeague = {
          id,
          name: trimmed || APP_CONFIG.defaultLeagueName,
          type: safeType,
          seasonLabel: String(new Date().getFullYear()),
          allowRosterEdits: false,
          teams: [],
        }
        updateLeagues((current) => [...current, newLeague])
        changeLeague(id)
      },
      clearActiveLeagueData: async () => {
        updatePlayers((current) => current.filter((player) => player.leagueId !== activeLeagueId))
        updateTournaments((current) => current.filter((tournament) => tournament.leagueId !== activeLeagueId))
        updateLeagues((current) =>
          current.map((league) => (league.id === activeLeagueId ? { ...league, teams: [] } : league)),
        )
      },
      deleteActiveLeague: async () => {
        await deleteLeague(activeDataset, activeLeagueId)
        updatePlayers((current) => current.filter((player) => player.leagueId !== activeLeagueId))
        updateTournaments((current) => current.filter((tournament) => tournament.leagueId !== activeLeagueId))
        updateLeagues((current) => current.filter((league) => league.id !== activeLeagueId))
      },
      resetActiveLeagueToMockData: async () => {
        if (activeDataset !== 'test') {
          throw new Error('Mock data restore is only allowed in the "test" dataset.')
        }
        const defaults = getDefaultLeagueData(activeLeagueId)
        updatePlayers((current) => [
          ...current.filter((player) => player.leagueId !== activeLeagueId),
          ...defaults.players,
        ])
        updateTournaments((current) => [
          ...current.filter((tournament) => tournament.leagueId !== activeLeagueId),
          ...defaults.tournaments,
        ])
        if (defaults.league) {
          updateLeagues((current) => current.map((league) => (league.id === activeLeagueId ? defaults.league : league)))
        }
      },
    }),
    [
      activeDataset,
      activeLeagueId,
      error,
      isLoading,
      leagues,
      players,
      tournaments,
      updateLeagues,
      updatePlayers,
      updateTournaments,
      changeLeague,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
