import { describe, it, expect, vi, afterEach } from 'vitest'
import { defineComponent } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { usePagedList } from './usePagedList'

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountList() {
  let list
  const Comp = defineComponent({
    setup() {
      list = usePagedList('/api/articles', { pageSize: 2 })
      return () => null
    },
  })
  const wrapper = mount(Comp)
  return { wrapper, list }
}

describe('usePagedList', () => {
  it('loads the first page and computes total pages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 5, items: [{ id: 1 }, { id: 2 }] }),
    }))
    const { wrapper, list } = mountList()
    await flushPromises()

    expect(list.items.value).toEqual([{ id: 1 }, { id: 2 }])
    expect(list.total.value).toBe(5)
    expect(list.totalPages.value).toBe(3)
    expect(list.loading.value).toBe(false)
    wrapper.unmount()
  })

  it('fetches the next page and ignores out-of-range pages', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total: 5, items: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const { wrapper, list } = mountList()
    await flushPromises()

    list.goTo(2)
    await flushPromises()
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/articles?page=2&page_size=2',
      { signal: undefined },
    )

    list.goTo(9)
    expect(list.page.value).toBe(2)
    wrapper.unmount()
  })
})
