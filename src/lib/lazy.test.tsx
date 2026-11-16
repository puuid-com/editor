import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { lazyPart, onLoadFailed, once } from './lazy'

function Hello({ name }: { name: string }) {
  return <p>Hello {name}</p>
}

describe('once', () => {
  it('runs a load one time for every caller', async () => {
    const load = vi.fn().mockResolvedValue('value')
    const get = once(load)
    expect(await Promise.all([get(), get()])).toEqual(['value', 'value'])
    await get()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('forgets a failed load, so the next call tries again', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue('value')
    const get = once(load)
    await expect(get()).rejects.toThrow('offline')
    expect(await get()).toBe('value')
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('lazyPart', () => {
  const stops: Array<() => void> = []
  afterEach(() => stops.splice(0).forEach((stop) => stop()))

  it('shows nothing until the component is there, then shows it', async () => {
    let arrive!: () => void
    const Part = lazyPart(
      () =>
        new Promise<typeof Hello>((resolve) => (arrive = () => resolve(Hello))),
    )
    const { container } = render(<Part name="Ann" />)
    expect(container).toBeEmptyDOMElement()
    await act(async () => arrive())
    expect(screen.getByText('Hello Ann')).toBeInTheDocument()
  })

  it('shows at once when it was fetched ahead of time', async () => {
    const load = vi.fn<() => Promise<typeof Hello>>().mockResolvedValue(Hello)
    const Part = lazyPart(load)
    const first = render(<Part name="Ann" />)
    await screen.findByText('Hello Ann')
    first.unmount()
    render(<Part name="Bob" />)
    // No wait: the second one has it on its first render.
    expect(screen.getByText('Hello Bob')).toBeInTheDocument()
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('stays empty when it cannot be fetched, and says so once', async () => {
    const Part = lazyPart(() =>
      Promise.reject<typeof Hello>(new Error('offline')),
    )
    const failed = vi.fn()
    stops.push(onLoadFailed(failed))
    const { container } = render(
      <>
        <Part name="Ann" />
        <Part name="Bob" />
      </>,
    )
    await waitFor(() => expect(failed).toHaveBeenCalled())
    // Both parts waited on the same failure.
    await act(async () => Promise.resolve())
    expect(failed).toHaveBeenCalledTimes(1)
    expect(container).toBeEmptyDOMElement()
  })

  it('tries again when the connection comes back', async () => {
    const load = vi
      .fn<() => Promise<typeof Hello>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(Hello)
    const Part = lazyPart(load)
    const failed = vi.fn()
    stops.push(onLoadFailed(failed))
    render(<Part name="Ann" />)
    await waitFor(() => expect(failed).toHaveBeenCalled())
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(await screen.findByText('Hello Ann')).toBeInTheDocument()
  })
})
