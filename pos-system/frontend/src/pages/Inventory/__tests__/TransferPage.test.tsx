import { render, screen } from '@testing-library/react'
import TransferPage from '../TransferPage'

describe('TransferPage', () => {
  it('renderiza formulario de transferencia', () => {
    render(<TransferPage />)
    expect(screen.getByText('Registrar Transferencia')).toBeTruthy()
  })
})
