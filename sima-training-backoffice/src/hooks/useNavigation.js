import { useState } from 'react'

export default function useNavigation(initial) {
  const [page, setPage] = useState(initial)
  return { page, navigate: setPage }
}
