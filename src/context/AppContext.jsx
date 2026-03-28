import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppContext } from './appContextInstance'
import { getDefaultLeagueData } from '../utils/defaultData'
import {
  getActiveDataset,
  getActiveLeague,
  isResetAllowed,
  loadDatasetData,
  saveLeagues,
  savePlayers,
  saveTournaments,
  setActiveDataset as persistActiveDataset,
  setActiveLeague as persistActiveLeague,
} from '../utils/dataService'

export const AppProvider = ({ children }) => {
  const [activeDataset, setActiveDataset] = useState(getActiveDataset())
  const [activeLeagueId, setActiveLeagueId] = useState(getActiveLeague())
  const [leagues, setLeagues] = useState([])
  const [players, setPlayers] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const loadedDatasetRef = useRef('')
  const loadRequestIdRef = useRef(0)
  const dataRevisionRef = useRef(0)

  const markDataDirty = () => {
    dataRevisionRef.current += 1
  }

  const loadData = async (dataset) => {
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
  }

  const changeDataset = (dataset) => {
    setActiveDataset(dataset)
    persistActiveDataset(dataset)
  }

  const changeLeague = (leagueId) => {
    setActiveLeagueId(leagueId)
    persistActiveLeague(leagueId)
  }

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
    loadData(activeDataset)
  }, [activeDataset])

  useEffect(() => {
    if (loadedDatasetRef.current !== activeDataset) return
    saveLeagues(activeDataset, leagues).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save leagues')
    })
  }, [activeDataset, leagues])

  useEffect(() => {
    if (loadedDatasetRef.current !== activeDataset) return
    savePlayers(activeDataset, players).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save players')
    })
  }, [activeDataset, players])

  useEffect(() => {
    if (loadedDatasetRef.current !== activeDataset) return
    saveTournaments(activeDataset, tournaments).catch((saveError) => {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save tournaments')
    })
  }, [activeDataset, tournaments])

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
      setActiveDataset: changeDataset,
      setActiveLeagueId: changeLeague,
      clearActiveLeagueData: async () => {
        updatePlayers((current) => current.filter((player) => player.leagueId !== activeLeagueId))
        updateTournaments((current) => current.filter((tournament) => tournament.leagueId !== activeLeagueId))
        updateLeagues((current) =>
          current.map((league) => (league.id === activeLeagueId ? { ...league, teams: [] } : league)),
        )
      },
      resetActiveLeagueToMockData: async () => {
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
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
