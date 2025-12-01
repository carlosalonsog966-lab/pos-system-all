import { render, screen } from '@testing-library/react'
import CycleCountsPage from '../CycleCountsPage'

describe('CycleCountsPage', () => {
  it('renderiza encabezado', () => {
    render(<CycleCountsPage />)
    expect(screen.getByText('Conteos Cíclicos')).toBeTruthy()
  })
})
