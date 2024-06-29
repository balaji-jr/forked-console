import { Box, Button, Modal, Select, Stack, Text, TextInput } from '@mantine/core';
import { filterStoreReducers, useFilterStore } from '../../providers/FilterProvider';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { makeTimeRangeLabel, useLogsStore } from '../../providers/LogsProvider';
import { CodeHighlight } from '@mantine/code-highlight';
import _ from 'lodash';
import { useAppStore } from '@/layouts/MainLayout/providers/AppProvider';
import { CreateSavedFilterType, SavedFilterType } from '@/@types/parseable/api/savedFilters';
import useSavedFiltersQuery from '@/hooks/useSavedFilters';
import Cookies from 'js-cookie';

const { toggleSaveFiltersModal } = filterStoreReducers;

interface FormObjectType extends Omit<SavedFilterType, 'filter_id' | 'version'> {
	isNew: boolean;
	isError: boolean;
	filter_id?: string;
	version?: string;
	timeRangeOptions: {value: string, label: string}[];
	selectedTimeRangeOption: {value: string, label: string}
}

const sanitizeFilterItem = (formObject: FormObjectType): SavedFilterType  => {
	const { stream_name, filter_name, filter_id = '', query, time_filter, user_id, version = '' } = formObject;
	return {
		filter_id,
		version,
		stream_name,
		filter_name,
		time_filter: time_filter ? time_filter : null,
		query,
		user_id,
	};
};

const defaultTimeRangeOption = {
	value: 'none',
	label: 'Time range not included',
}

const makeTimeRangeOptions = ({
	selected,
	current,
}: {
	selected: { from: string; to: string } | null;
	current: { startTime: Date; endTime: Date };
}) => {
	return [
		defaultTimeRangeOption,
		{
			value: 'current',
			label: `Current - ${makeTimeRangeLabel(current.startTime, current.endTime)}`,
		},
		...(selected ? [{ value: 'selected', label: `Stored - ${makeTimeRangeLabel(selected.from, selected.to)}` }] : []),
	];
};

const getDefaultTimeRangeOption = (opts: {value: string, label: string}[]) => {
	const selectedTimeRange = _.find(opts, (option) => option.value === 'selected');
	return selectedTimeRange ? selectedTimeRange : defaultTimeRangeOption
}

const SaveFilterModal = () => {
	const username = Cookies.get('username');
	const [isSaveFiltersModalOpen, setFilterStore] = useFilterStore((store) => store.isSaveFiltersModalOpen);
	const [appliedQuery] = useFilterStore((store) => store.appliedQuery);
	const [activeSavedFilters] = useAppStore((store) => store.activeSavedFilters);
	const [formObject, setFormObject] = useState<FormObjectType | null>(null);
	const [currentStream] = useAppStore((store) => store.currentStream);
	const [timeRange] = useLogsStore((store) => store.timeRange);
	const [{ custSearchQuery, savedFilterId, activeMode }] = useLogsStore((store) => store.custQuerySearchState);
	const [isDirty, setDirty] = useState<boolean>(false);

	const { updateSavedFilters, createSavedFilters } = useSavedFiltersQuery();

	useEffect(() => {
		const selectedFilter = _.find(activeSavedFilters, (filter) => filter.filter_id === savedFilterId);
		if (!currentStream || !activeMode) return;

		if (selectedFilter) {
			const { time_filter } = selectedFilter;
			const timeRangeOptions = makeTimeRangeOptions({selected: time_filter, current: timeRange});
			const selectedTimeRangeOption = getDefaultTimeRangeOption(timeRangeOptions)
			setFormObject({
				...selectedFilter,
				isNew: false,
				isError: false,
				timeRangeOptions,
				selectedTimeRangeOption
			});
		} else {
			const isSqlMode = activeMode === 'sql';
			const timeRangeOptions = makeTimeRangeOptions({ selected: null, current: timeRange });
			const selectedTimeRangeOption = getDefaultTimeRangeOption(timeRangeOptions);
			setFormObject({
				stream_name: currentStream,
				filter_name: '',
				query: {
					filter_type: isSqlMode ? 'sql' : 'builder',
					...(isSqlMode ? { filter_query: custSearchQuery } : { filter_builder: appliedQuery }),
				},
				time_filter: {
					from: timeRange.startTime.toISOString(),
					to: timeRange.endTime.toISOString(),
				},
				isNew: true,
				isError: false,
				user_id: username || '',
				timeRangeOptions,
				selectedTimeRangeOption
			});
		}
	}, [custSearchQuery, savedFilterId, activeMode, timeRange]);

	const closeModal = useCallback(() => {
		setFilterStore((store) => toggleSaveFiltersModal(store, false));
	}, []);

	const onToggleIncludeTimeRange = useCallback((value: string | null) => {
		setDirty(true);
		setFormObject((prev) => {
			if (!prev) return null;

			const time_filter =
				value === 'none' || value === null
					? null
					: value === 'selected'
					? prev.time_filter
					: {
							from: timeRange.startTime.toISOString(),
							to: timeRange.endTime.toISOString(),
					  };
			return {
				...prev,
				time_filter,
				selectedTimeRangeOption: _.find(prev.timeRangeOptions, option => option.value === value) || defaultTimeRangeOption
			};
		});
	}, [timeRange]);

	const onSubmit = useCallback(() => {
		if (!formObject) return;

		if (_.isEmpty(formObject?.filter_name)) {
			return setFormObject((prev) => {
				if (!prev) return null;

				return {
					...prev,
					isError: true,
				};
			});
		}

		if (!_.isEmpty(formObject.filter_id) && !_.isEmpty(formObject.user_id) && !_.isEmpty(formObject.version)) {
			updateSavedFilters({ filter: sanitizeFilterItem(formObject), onSuccess: closeModal });
		} else {
			const keysToRemove = ['filter_id', 'version'];
			const sanitizedFilterItem = sanitizeFilterItem(formObject);
			const filteredEntries = Object.entries(sanitizedFilterItem).filter(([key]) => !keysToRemove.includes(key));
			const newObj: CreateSavedFilterType = Object.fromEntries(filteredEntries) as CreateSavedFilterType;
			createSavedFilters({ filter: newObj, onSuccess: closeModal });
		}
	}, [formObject]);

	const onNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
		setDirty(true);
		setFormObject((prev) => {
			if (!prev) return null;

			return {
				...prev,
				filter_name: e.target.value,
				isError: _.isEmpty(e.target.value),
			};
		});
	}, []);

	return (
		<Modal
			opened={isSaveFiltersModalOpen}
			onClose={closeModal}
			size="auto"
			centered
			styles={{ body: { padding: '0 1rem 1rem 1rem' }, header: { padding: '1rem', paddingBottom: '0.4rem' } }}
			title={
				<Text style={{ fontSize: '0.9rem', fontWeight: 600 }}>
					{formObject?.isNew ? 'Save Filters' : 'Update Filters'}
				</Text>
			}>
			<Stack w={600} gap={14}>
				<Stack>
					<TextInput
						onChange={onNameChange}
						withAsterisk
						label="Name"
						error={isDirty && formObject?.isError && 'Name cannot be empty'}
						value={formObject?.filter_name}
					/>
				</Stack>
				<Stack style={{ flexDirection: 'row', alignItems: 'center' }}>
					<Stack gap={4} style={{ width: '100%' }}>
						<Text style={{ fontSize: '0.7rem', fontWeight: 500 }}>Fixed Time Range</Text>
						<Select data={formObject?.timeRangeOptions}  value={formObject?.selectedTimeRangeOption.value} onChange={onToggleIncludeTimeRange}/>
					</Stack>
				</Stack>
				<Stack gap={4}>
					<Text style={{ fontSize: '0.7rem', fontWeight: 500 }}>Query</Text>
					<CodeHighlight
						code={custSearchQuery}
						language="sql"
						withCopyButton={false}
						styles={{
							code: {
								fontSize: '0.72rem',
								whiteSpace: 'pre-wrap',
								wordBreak: 'break-word',
							},
						}}
					/>
				</Stack>
				<Stack style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%', marginTop: 10 }}>
					<Box>
						<Button miw={100} variant="outline" onClick={closeModal}>
							Cancel
						</Button>
					</Box>
					<Box>
						<Button miw={100} onClick={onSubmit}>
							Save
						</Button>
					</Box>
				</Stack>
			</Stack>
		</Modal>
	);
};

export default SaveFilterModal;
