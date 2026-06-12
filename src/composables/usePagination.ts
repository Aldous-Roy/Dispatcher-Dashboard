import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export function usePagination<T>(
  fetchFn: (params: { page: number; size: number; sort: string; search: string }) => Promise<any>,
  defaultSort: string = 'createdAt,desc',
  defaultSize: number = 10
) {
  const route = useRoute()
  const router = useRouter()

  const items = ref<T[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Initialize from query parameters
  const page = ref(Number(route.query.page) || 1)
  const size = ref(Number(route.query.size) || defaultSize)
  const search = ref((route.query.search as string) || '')
  
  // Sort format like "employeeId,asc"
  const sort = ref((route.query.sort as string) || defaultSort)

  const updateUrl = () => {
    router.replace({
      query: {
        ...route.query,
        page: page.value.toString(),
        size: size.value.toString(),
        search: search.value || undefined,
        sort: sort.value || undefined
      }
    })
  }

  const loadData = async () => {
    loading.value = true
    error.value = null
    try {
      // API page is 0-indexed, UI is 1-indexed
      const response = await fetchFn({
        page: page.value - 1,
        size: size.value,
        sort: sort.value,
        search: search.value
      })
      
      // Axios requests using apiClient return un-wrapped data or custom structures
      const dataPayload = response?.data || response
      if (dataPayload) {
        items.value = dataPayload.content || dataPayload.data?.content || dataPayload.data || dataPayload || []
        total.value = dataPayload.totalElements || dataPayload.data?.totalElements || dataPayload.total || items.value.length
      } else {
        items.value = []
        total.value = 0
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message || 'Error fetching data'
      items.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  // Debounced search function
  let debounceTimeout: ReturnType<typeof setTimeout>
  const handleSearch = () => {
    clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(() => {
      page.value = 1 // reset to first page
      updateUrl()
      loadData()
    }, 400)
  }

  const handleSort = (field: string) => {
    const [currField, currOrder] = sort.value.split(',')
    if (currField === field) {
      sort.value = `${field},${currOrder === 'asc' ? 'desc' : 'asc'}`
    } else {
      sort.value = `${field},asc`
    }
    page.value = 1
    updateUrl()
    loadData()
  }

  const changePage = (newPage: number) => {
    page.value = newPage
    updateUrl()
    loadData()
  }

  // Watch route query to support back/forward browser navigation
  watch(
    () => route.query,
    (newQuery) => {
      const newPage = Number(newQuery.page) || 1
      const newSize = Number(newQuery.size) || defaultSize
      const newSearch = (newQuery.search as string) || ''
      const newSort = (newQuery.sort as string) || defaultSort

      if (
        page.value !== newPage ||
        size.value !== newSize ||
        search.value !== newSearch ||
        sort.value !== newSort
      ) {
        page.value = newPage
        size.value = newSize
        search.value = newSearch
        sort.value = newSort
        loadData()
      }
    }
  )

  onMounted(() => {
    loadData()
  })

  return {
    items,
    total,
    loading,
    error,
    page,
    size,
    search,
    sort,
    loadData,
    handleSearch,
    handleSort,
    changePage
  }
}
