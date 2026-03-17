import { useState, useEffect } from 'react'

interface Props {
  value: number
  onChange: (val: number) => void
  decimals?: number
  min?: number
  max?: number
  className?: string
  placeholder?: string
  readOnly?: boolean
  style?: React.CSSProperties
}

export default function FormattedNumberInput({ 
  value, 
  onChange, 
  decimals = 0, 
  min, 
  max, 
  className, 
  placeholder, 
  readOnly, 
  style 
}: Props) {
  const [isFocused, setIsFocused] = useState(false)
  const [localVal, setLocalVal] = useState('')

  const formatValue = (val: number) => {
    if (isNaN(val)) return ''
    return val.toLocaleString('es-CL', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
  }

  useEffect(() => {
    if (!isFocused) {
      setLocalVal(formatValue(value))
    }
  }, [value, isFocused, decimals])

  const handleBlur = () => {
    setIsFocused(false)
    const cleanStr = localVal.replace(/\./g, '').replace(',', '.')
    let num = parseFloat(cleanStr)
    
    if (isNaN(num)) {
       num = 0
    }
    
    if (min !== undefined && num < min) num = min
    if (max !== undefined && num > max) num = max

    onChange(num)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    if (value === 0 && localVal === formatValue(0)) {
        setLocalVal('') 
    } else {
        setLocalVal(formatValue(value).replace(/\./g, ''))
    }
    requestAnimationFrame(() => {
      e.target.select()
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (/^[0-9.,-]*$/.test(val)) {
      setLocalVal(val)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  return (
    <input
      type="text"
      className={className}
      value={isFocused ? localVal : formatValue(value)}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      readOnly={readOnly}
      style={style}
    />
  )
}
