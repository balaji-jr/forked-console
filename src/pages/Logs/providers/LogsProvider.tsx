import { Log } from '@/@types/parseable/api/query';
import { LogStreamData, LogStreamSchemaData } from '@/@types/parseable/api/stream';
import { FIXED_DURATIONS, FixedDuration } from '@/constants/timeConstants';
import initContext from '@/utils/initContext';
import dayjs from 'dayjs';
import { addOrRemoveElement } from '@/utils';
import { getPageSlice, makeHeadersFromSchema, makeHeadersfromData } from '../utils';
import _ from 'lodash';

export const DEFAULT_FIXED_DURATIONS = FIXED_DURATIONS[0];

type ReducerOutput = Partial<LogsStore>;

type TimeRange = {
	startTime: Date;
	endTime: Date;
	type: 'fixed' | 'custom';
	label: string;
	interval: number | null;
};

enum SortOrder {
	ASCENDING = 1,
	DESCENDING = -1,
}

type QuickFilters = {
	search: string;
	filters: Record<string, string[]>;
	sort: {
		key: string;
		order: SortOrder;
	};
};

type LiveTailStatus = 'streaming' | 'stopped' | 'abort' | 'fetch' | '';

type LiveTailConfig = {
	liveTailStatus: LiveTailStatus;
	liveTailSchemaData: LogStreamData;
	liveTailSearchValue: string;
	liveTailSearchField: string;
};

const getDefaultTimeRange = (duration: FixedDuration = DEFAULT_FIXED_DURATIONS) => {
	const now = dayjs().startOf('minute');
	const { milliseconds, name } = duration;
	return {
		startTime: now.subtract(milliseconds, 'milliseconds').toDate(),
		endTime: now.toDate(),
		type: 'fixed' as 'fixed',
		label: name,
		interval: milliseconds,
	};
};

const defaultQuickFilters = {
	search: '',
	filters: {},
	sort: {
		key: 'p_timestamp',
		order: SortOrder.DESCENDING,
	},
};

const defaultLiveTailConfig = {
	liveTailStatus: '' as '',
	liveTailSchemaData: [],
	liveTailSearchValue: '',
	liveTailSearchField: '',
};

const defaultCustQuerySearchState = {
	showQueryBuilder: false,
	isQuerySearchActive: false,
	custSearchQuery: '',
	viewMode: 'filters',
	activeMode: null,
};

type LogQueryData = {
	rawData: Log[];
	filteredData: Log[];
};

type CustQuerySearchState = {
	showQueryBuilder: boolean;
	isQuerySearchActive: boolean;
	custSearchQuery: string;
	viewMode: string;
	activeMode: null | 'filters' | 'sql';
};

type LogsStore = {
	timeRange: TimeRange;
	quickFilters: QuickFilters;
	liveTailConfig: LiveTailConfig;
	refreshInterval: number | null;
	selectedLog: Log | null;
	custQuerySearchState: CustQuerySearchState;

	modalOpts: {
		deleteModalOpen: boolean;
		alertsModalOpen: boolean;
		retentionModalOpen: boolean;
		queryBuilderModalOpen: boolean;
	};

	tableOpts: {
		disabledColumns: string[];
		pinnedColumns: string[];
		pageData: Log[];
		totalPages: number;
		totalCount: number;
		displayedCount: number;
		currentPage: number;
		perPage: number;
		currentOffset: number;
		headers: string[];
		sortKey: string;
		sortOrder: 'asc' | 'desc';
		filters: Record<string, string[]>;
	};

	data: LogQueryData & {
		schema: LogStreamSchemaData | null;
	};
};

type LogsStoreReducers = {
	setTimeRange: (store: LogsStore, payload: Partial<TimeRange>) => ReducerOutput;
	resetTimeRange: (store: LogsStore) => ReducerOutput;
	deleteFilterItem: (store: LogsStore, key: string) => ReducerOutput;
	addFilterItem: (store: LogsStore, key: string, value: string[]) => ReducerOutput;
	setLiveTailStatus: (store: LogsStore, liveTailStatus: LiveTailStatus) => ReducerOutput;
	resetLiveTailSearchState: (store: LogsStore) => ReducerOutput;
	setLiveTailSchema: (store: LogsStore, liveTailSchemaData: LogStreamData) => ReducerOutput;
	setRefreshInterval: (store: LogsStore, interval: number | null) => ReducerOutput;
	resetQuickFilters: (store: LogsStore) => ReducerOutput;
	streamChangeCleanup: (store: LogsStore) => ReducerOutput;
	toggleQueryBuilder: (store: LogsStore) => ReducerOutput;
	resetCustQuerySearchState: (store: LogsStore) => ReducerOutput;
	setCustQuerySearchState: (store: LogsStore, payload: Partial<CustQuerySearchState>) => ReducerOutput;
	toggleCustQuerySearchViewMode: (store: LogsStore, targetMode: 'sql' | 'filters') => ReducerOutput;
	toggleDeleteModal: (store: LogsStore) => ReducerOutput;
	toggleAlertsModal: (store: LogsStore) => ReducerOutput;
	toggleRetentionModal: (store: LogsStore) => ReducerOutput;

	// table opts reducers
	toggleDisabledColumns: (store: LogsStore, columnName: string) => ReducerOutput;
	togglePinnedColumns: (store: LogsStore, columnName: string) => ReducerOutput;
	setCurrentOffset: (store: LogsStore, offset: number) => ReducerOutput;
	setPerPage: (store: LogsStore, perPage: number) => ReducerOutput;
	setCurrentPage: (store: LogsStore, page: number) => ReducerOutput;
	setTotalCount: (store: LogsStore, totalCount: number) => ReducerOutput;
	setPageAndPageData: (store: LogsStore, pageNo: number) => ReducerOutput;
	setAndSortData: (store: LogsStore, sortKey: string, sortOrder: 'asc' | 'desc') => ReducerOutput;
	setAndFilterData: (store: LogsStore, filterKey: string, filterValues: string[], remove?: boolean) => ReducerOutput;
	getCleanStoreForRefetch: (store: LogsStore) => ReducerOutput;

	// data reducers
	setData: (store: LogsStore, data: Log[]) => ReducerOutput;
	setStreamSchema: (store: LogsStore, schema: LogStreamSchemaData) => ReducerOutput;
	applyCustomQuery: (store: LogsStore, query: string, mode: 'filters' | 'sql') => ReducerOutput;
	getUniqueValues: (data: Log[], key: string) => string[];
};

const initialState: LogsStore = {
	timeRange: getDefaultTimeRange(),
	quickFilters: defaultQuickFilters,
	liveTailConfig: defaultLiveTailConfig,
	refreshInterval: null,
	selectedLog: null,
	custQuerySearchState: defaultCustQuerySearchState,

	modalOpts: {
		deleteModalOpen: false,
		alertsModalOpen: false,
		retentionModalOpen: false,
		queryBuilderModalOpen: false,
	},

	tableOpts: {
		disabledColumns: [],
		pinnedColumns: [],
		pageData: [],
		perPage: 30,
		totalCount: 0,
		displayedCount: 0,
		totalPages: 0,
		currentPage: 0,
		currentOffset: 0,
		headers: [],
		sortKey: 'p_timestamp',
		sortOrder: 'desc',
		filters: {},
	},

	// data
	data: {
		rawData: [],
		filteredData: [],
		schema: null,
	},
	// if adding new fields, verify streamChangeCleanup
};

const { Provider: LogsProvider, useStore: useLogsStore } = initContext(initialState);

const getTotalPages = (data: Log[], perPage: number) => {
	return _.isEmpty(data) ? 0 : _.size(data) / perPage;
};

// reducers
const setTimeRange = (store: LogsStore, payload: Partial<TimeRange>) => {
	const { label } = payload;
	const duration = _.find(FIXED_DURATIONS, (duration) => duration.name === label);
	const interval = duration?.milliseconds || null;
	return { timeRange: { ...store.timeRange, ...payload, interval } };
};

const resetTimeRange = (store: LogsStore) => {
	const now = dayjs();
	const timeDiff = store.timeRange.endTime.getTime() - store.timeRange.startTime.getTime();
	const startTime = now.subtract(timeDiff).toDate();
	const endTime = now.toDate();
	return store.timeRange.type === 'custom' ? store : { timeRange: { ...store.timeRange, startTime, endTime } };
};

const deleteFilterItem = (store: LogsStore, key: string) => {
	const filters = store.quickFilters.filters;
	const updatedFilters = (({ [key]: _, ...filters }) => filters)(filters);
	return { quickFilters: { ...store.quickFilters, filters: updatedFilters } };
};

const addFilterItem = (store: LogsStore, key: string, value: string[]) => {
	const filters = store.quickFilters.filters;
	const updatedFilters = { ...filters, [key]: value };
	return { quickFilters: { ...store.quickFilters, filters: updatedFilters } };
};

const resetQuickFilters = (_store: LogsStore) => {
	return { quickFilters: defaultQuickFilters };
};

const setLiveTailStatus = (store: LogsStore, liveTailStatus: LiveTailStatus) => {
	const { liveTailConfig } = store;
	return { liveTailConfig: { ...liveTailConfig, liveTailStatus } };
};

const resetLiveTailSearchState = (store: LogsStore) => {
	return { liveTailConfig: { ...store.liveTailConfig, liveTailSearchValue: '', liveTailSearchField: '' } };
};

const setLiveTailSchema = (store: LogsStore, liveTailSchemaData: LogStreamData) => {
	return { liveTailConfig: { ...store.liveTailConfig, liveTailSchemaData } };
};

const setRefreshInterval = (_store: LogsStore, interval: number | null) => {
	return { refreshInterval: interval };
};

const streamChangeCleanup = (_store: LogsStore) => {
	return { ...initialState };
};

const toggleQueryBuilder = (store: LogsStore) => {
	const { custQuerySearchState } = store;
	return {
		custQuerySearchState: { ...custQuerySearchState, showQueryBuilder: !custQuerySearchState.showQueryBuilder },
	};
};

const resetCustQuerySearchState = (store: LogsStore) => {
	const { custQuerySearchState } = store;
	return {
		custQuerySearchState: { ...defaultCustQuerySearchState, viewMode: custQuerySearchState.viewMode },
		...getCleanStoreForRefetch(store),
	};
};

const setCustQuerySearchState = (store: LogsStore, payload: Partial<CustQuerySearchState>) => {
	const { custQuerySearchState } = store;
	return {
		custQuerySearchState: { ...custQuerySearchState, ...payload, isQuerySearchActive: true, showQueryBuilder: false },
	};
};

const toggleCustQuerySearchViewMode = (store: LogsStore, targetMode: 'filters' | 'sql') => {
	const { custQuerySearchState } = store;

	return {
		custQuerySearchState: { ...custQuerySearchState, viewMode: targetMode },
	};
};

const toggleDeleteModal = (store: LogsStore) => {
	const { modalOpts } = store;
	return { modalOpts: { ...modalOpts, deleteModalOpen: !modalOpts.deleteModalOpen } };
};

const toggleRetentionModal = (store: LogsStore) => {
	const { modalOpts } = store;
	return { modalOpts: { ...modalOpts, retentionModalOpen: !modalOpts.retentionModalOpen } };
};

const toggleAlertsModal = (store: LogsStore) => {
	const { modalOpts } = store;
	return { modalOpts: { ...modalOpts, alertsModalOpen: !modalOpts.alertsModalOpen } };
};

const toggleDisabledColumns = (store: LogsStore, columnName: string) => {
	const { tableOpts } = store;
	return {
		tableOpts: {
			...tableOpts,
			disabledColumns: addOrRemoveElement(tableOpts.disabledColumns, columnName),
		},
	};
};

const togglePinnedColumns = (store: LogsStore, columnName: string) => {
	const { tableOpts } = store;
	return {
		tableOpts: {
			...tableOpts,
			pinnedColumns: addOrRemoveElement(tableOpts.pinnedColumns, columnName),
		},
	};
};

const filterAndSortData = (
	opts: { sortOrder: 'asc' | 'desc'; sortKey: string; filters: Record<string, string[]> },
	data: Log[],
) => {
	const { sortOrder, sortKey, filters } = opts;
	const filteredData = _.isEmpty(filters)
		? data
		: (_.reduce(
				data,
				(acc: Log[], d: Log) => {
					const doesMatch = _.some(filters, (value, key) => _.includes(value, _.toString(d[key])));
					return doesMatch ? [...acc, d] : acc;
				},
				[],
		  ) as Log[]);
	const sortedData = _.orderBy(filteredData, [sortKey], [sortOrder]);
	return sortedData;
};

const setData = (store: LogsStore, data: Log[]) => {
	const { data: existingData, custQuerySearchState, tableOpts } = store;
	const currentPage = tableOpts.currentPage === 0 ? 1 : tableOpts.currentPage;
	const filteredData = filterAndSortData(tableOpts, data);
	const newPageSlice = filteredData && getPageSlice(currentPage, tableOpts.perPage, filteredData);

	// only if pageoffset is 1
	const newHeaders =
		filteredData && existingData.schema && custQuerySearchState.isQuerySearchActive
			? makeHeadersfromData(existingData.schema, custQuerySearchState.custSearchQuery)
			: makeHeadersFromSchema(existingData.schema);

	return {
		tableOpts: {
			...store.tableOpts,
			...(newPageSlice ? { pageData: newPageSlice } : {}),
			...(newHeaders ? { headers: newHeaders } : {}),
			currentPage,
			totalPages: getTotalPages(filteredData, tableOpts.perPage),
		},
		data: { ...existingData, rawData: data, filteredData: data },
	};
};

const setStreamSchema = (store: LogsStore, schema: LogStreamSchemaData) => {
	return {
		data: {
			...store.data,
			schema,
		},
	};
};

const setPerPage = (store: LogsStore, perPage: number) => {
	return {
		tableOpts: {
			...store.tableOpts,
			perPage,
		},
	};
};

const setCurrentPage = (store: LogsStore, currentPage: number) => {
	return {
		tableOpts: {
			...store.tableOpts,
			currentPage,
		},
	};
};

const setCurrentOffset = (store: LogsStore, currentOffset: number) => {
	return {
		tableOpts: {
			...store.tableOpts,
			currentOffset,
		},
	};
};

const setTotalCount = (store: LogsStore, totalCount: number) => {
	return {
		tableOpts: {
			...store.tableOpts,
			totalCount,
		},
	};
};

const setPageAndPageData = (store: LogsStore, pageNo: number) => {
	const {
		data: { filteredData },
		tableOpts,
	} = store;
	const newPageSlice = filteredData && getPageSlice(pageNo, tableOpts.perPage, filteredData);

	return {
		tableOpts: {
			...store.tableOpts,
			pageData: newPageSlice,
			currentPage: pageNo,
			totalPages: getTotalPages(filteredData, tableOpts.perPage),
		},
	};
};

const getCleanStoreForRefetch = (store: LogsStore) => {
	const { tableOpts, data, timeRange } = store;
	const { interval, type } = timeRange;

	const duration = _.find(FIXED_DURATIONS, (duration) => duration.name === timeRange.label);
	const updatedTimeRange = interval && type === 'fixed' ? { timeRange: getDefaultTimeRange(duration) } : {};
	return {
		tableOpts: {
			...tableOpts,
			pageData: [],
			totalCount: 0,
			displayedCount: 0,
			currentPage: 0,
			currentOffset: 0,
			headers: [],
			totalPages: 0,
		},
		data: {
			...data,
			filteredData: [],
			rawData: [],
		},
		...updatedTimeRange,
	};
};

const applyCustomQuery = (store: LogsStore, query: string, mode: 'filters' | 'sql') => {
	const { custQuerySearchState } = store;
	return {
		custQuerySearchState: {
			...custQuerySearchState,
			showQueryBuilder: false,
			isQuerySearchActive: true,
			custSearchQuery: query,
			activeMode: mode,
		},
		...getCleanStoreForRefetch(store),
	};
};

const setAndSortData = (store: LogsStore, sortKey: string, sortOrder: 'asc' | 'desc') => {
	const { data, tableOpts } = store;
	const filteredData = filterAndSortData({ sortKey, sortOrder, filters: tableOpts.filters }, data.rawData);
	const currentPage = 1;
	const newPageSlice = getPageSlice(currentPage, tableOpts.perPage, filteredData);

	return {
		data: {
			...data,
			filteredData,
		},
		tableOpts: {
			...tableOpts,
			sortKey,
			sortOrder,
			pageData: newPageSlice,
			currentPage,
			totalPages: getTotalPages(filteredData, tableOpts.perPage),
		},
	};
};

const setAndFilterData = (store: LogsStore, filterKey: string, filterValues: string[], remove: boolean = false) => {
	const { data, tableOpts } = store;
	const { sortKey, sortOrder, filters } = tableOpts;
	const updatedFilters = remove ? _.omit(filters, filterKey) : { ...filters, [filterKey]: filterValues };
	const filteredData = filterAndSortData({ sortOrder, sortKey, filters: updatedFilters }, data.rawData);
	const currentPage = 1;
	const newPageSlice = getPageSlice(currentPage, tableOpts.perPage, filteredData);

	return {
		data: {
			...data,
			filteredData,
		},
		tableOpts: {
			...tableOpts,
			filters: updatedFilters,
			pageData: newPageSlice,
			currentPage,
			totalPages: getTotalPages(filteredData, tableOpts.perPage),
		},
	};
};

const getUniqueValues = (data: Log[], key: string) => {
	return _.chain(data)
		.map(key)
		.compact()
		.uniq()
		.map((v) => _.toString(v))
		.value();
};

const logsStoreReducers: LogsStoreReducers = {
	setTimeRange,
	resetTimeRange,
	deleteFilterItem,
	addFilterItem,
	setLiveTailStatus,
	resetLiveTailSearchState,
	setLiveTailSchema,
	setRefreshInterval,
	resetQuickFilters,
	streamChangeCleanup,
	toggleQueryBuilder,
	resetCustQuerySearchState,
	setCustQuerySearchState,
	toggleCustQuerySearchViewMode,
	toggleAlertsModal,
	toggleRetentionModal,
	toggleDeleteModal,
	toggleDisabledColumns,
	togglePinnedColumns,
	setData,
	setStreamSchema,
	setPerPage,
	setCurrentPage,
	setCurrentOffset,
	setTotalCount,
	setPageAndPageData,
	applyCustomQuery,
	setAndSortData,
	getUniqueValues,
	setAndFilterData,
	getCleanStoreForRefetch,
};

export { LogsProvider, useLogsStore, logsStoreReducers };
