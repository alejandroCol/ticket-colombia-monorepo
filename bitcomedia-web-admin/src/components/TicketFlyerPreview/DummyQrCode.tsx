import React from 'react';

/** Patrón fijo tipo QR para la vista previa (no codifica datos reales). */
const QR_GRID = [
  '111111101010101010101',
  '100001101101011010110',
  '101101100011001100110',
  '101101111110111011101',
  '101101100011001100110',
  '100001101101011010110',
  '111111101010101010101',
  '010101110100101101011',
  '110100101110011010100',
  '011011010011101100101',
  '101010111100010111010',
  '110011001101001011100',
  '001101010110100101101',
  '101100110010011011010',
  '011010001101100110101',
  '100101101001010110011',
  '010110010110100101100',
  '110001011010011001011',
  '011100101100110010110',
  '101011010001101101001',
  '010101110100101101011',
];

interface DummyQrCodeProps {
  className?: string;
  'aria-hidden'?: boolean;
}

const DummyQrCode: React.FC<DummyQrCodeProps> = ({ className, 'aria-hidden': ariaHidden = true }) => (
  <svg
    className={className}
    viewBox="0 0 21 21"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-hidden={ariaHidden}
    aria-label={ariaHidden ? undefined : 'Código QR de ejemplo'}
  >
    <rect width="21" height="21" fill="#ffffff" />
    {QR_GRID.map((row, rowIndex) =>
      row.split('').map((cell, colIndex) =>
        cell === '1' ? (
          <rect key={`${rowIndex}-${colIndex}`} x={colIndex} y={rowIndex} width={1} height={1} fill="#111111" />
        ) : null
      )
    )}
    {/* Marcadores de posición */}
    <rect x="0.5" y="0.5" width="6" height="6" fill="none" stroke="#111" strokeWidth="0.8" />
    <rect x="2" y="2" width="3" height="3" fill="#111" />
    <rect x="14.5" y="0.5" width="6" height="6" fill="none" stroke="#111" strokeWidth="0.8" />
    <rect x="16" y="2" width="3" height="3" fill="#111" />
    <rect x="0.5" y="14.5" width="6" height="6" fill="none" stroke="#111" strokeWidth="0.8" />
    <rect x="2" y="16" width="3" height="3" fill="#111" />
  </svg>
);

export default DummyQrCode;
