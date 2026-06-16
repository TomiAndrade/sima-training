import { useState } from 'react'

export default function useNavigation(initial) {
  const [state, setState] = useState(initial)
  return { state, setState }
}
