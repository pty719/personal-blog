import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TocList from './TocList.vue'

describe('TocList', () => {
  it('renders links, sub-levels and the active item', () => {
    const wrapper = mount(TocList, {
      props: {
        items: [
          { id: 'a', text: '第一节', level: 2 },
          { id: 'b', text: '小节', level: 3 },
        ],
        activeId: 'b',
      },
    })

    expect(wrapper.findAll('a')).toHaveLength(2)
    expect(wrapper.find('a').attributes('href')).toBe('#a')
    expect(wrapper.find('.toc-link--active').text()).toBe('小节')
    expect(wrapper.find('.toc-item--sub').exists()).toBe(true)
  })
})
