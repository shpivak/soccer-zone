import { useEffect, useMemo, useState } from 'react'
import { AppContext } from './appContextInstance'
import {
  getActiveDataset,
  getActiveLeague,
  loadDatasetData,
  resetDatasetData,
  savePlayers,
  saveTournaments,
  setActiveDataset as persistActiveDataset,
  setActiveLeague as persistActiveLeague,
} from '../utils/dataService'

export const AppProvider = ({ children }) => {
  const [activeDataset, setActiveDataset] = useState(getActiveDataset())
  const [activeLeagueId, setActiveLeagueId] = useState(getActiveLeague())
  const initialData = useMemo(() => loadDatasetData(activeDataset), [activeDataset])
  const [players, setPlayers] = useState(initialData.players)
  const [tournaments, setTournaments] = useState(initialData.tournaments)

  const changeDataset = (dataset) => {
    const data = loadDatasetData(dataset)
    setPlayers(data.players)
    setTournaments(data.tournaments)
    setActiveDataset(dataset)
    persistActiveDataset(dataset)
  }

  const changeLeague = (leagueId) => {
    setActiveLeagueId(leagueId)
    persistActiveLeague(leagueId)
  }

  useEffect(() => {
    savePlayers(activeDataset, players)
  }, [activeDataset, players])

  useEffect(() => {
    saveTournaments(activeDataset, tournaments)
  }, [activeDataset, tournaments])

  const value = useMemo(
    () => ({
      activeDataset,
      activeLeagueId,
      players,
      tournaments,
      setPlayers,
      setTournaments,
      setActiveDataset: changeDataset,
      setActiveLeagueId: changeLeague,
      resetActiveDataset: () => {
        resetDatasetData(activeDataset)
        const data = loadDatasetData(activeDataset)
        setPlayers(data.players)
        setTournaments(data.tournaments)
      },
    }),
    [activeDataset, activeLeagueId, players, tournaments],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
