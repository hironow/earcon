import { expect, test } from 'bun:test'
import { version as reactVersion } from 'react'
import { version as reactDOMVersion } from 'react-dom'

test('React and its DOM renderer use exactly the same runtime version', () => {
  expect(reactDOMVersion).toBe(reactVersion)
})
