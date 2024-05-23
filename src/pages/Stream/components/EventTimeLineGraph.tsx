import { Paper, Skeleton, Stack, Text } from '@mantine/core';
import classes from '../styles/EventTimeLineGraph.module.css';
import { useQueryResult } from '@/hooks/useQueryResult';
import { useCallback, useEffect, useMemo } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { ChartTooltipProps, AreaChart } from '@mantine/charts';
import { HumanizeNumber } from '@/utils/formatBytes';
import { logsStoreReducers, useLogsStore } from '../providers/LogsProvider';
import { useAppStore } from '@/layouts/MainLayout/providers/AppProvider';
const { setTimeRange } = logsStoreReducers;

const generateCountQuery = (streamName: string, startTime: string, endTime: string) => {
	return `SELECT DATE_TRUNC('minute', p_timestamp) AS minute_range, COUNT(*) AS log_count FROM ${streamName} WHERE p_timestamp BETWEEN '${startTime}' AND '${endTime}' GROUP BY minute_range ORDER BY minute_range`;
};

const NoDataView = () => {
	return (
		<Stack style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
			<Stack className={classes.noDataContainer}>
				<Text className={classes.noDataText}>No new events in the last 30 minutes.</Text>
			</Stack>
		</Stack>
	);
};

type GraphRecord = {
	minute_range: string;
	log_count: number;
};

const calcAverage = (data: GraphRecord[]) => {
	if (!Array.isArray(data) || data.length === 0) return 0;

	const total = data.reduce((acc, d) => {
		return acc + d.log_count;
	}, 0);
	return parseInt(Math.abs(total / data.length).toFixed(0));
};

const getAllTimestamps = (startTime: Dayjs, interval: number) => {
	const timestamps = [];
	const totalMinutes = interval / (1000 * 60)
	for (let i = 0; i < totalMinutes; i++) {
		const ts = startTime.add(i + 1, 'minute');
		timestamps.push(ts.toISOString().split('.')[0] + 'Z');
	}
	return timestamps;
};

// date_trunc removes tz info
// filling data empty values where there is no rec
const parseGraphData = (data: GraphRecord[], avg: number, startTime: Dayjs, interval: number) => {
	if (!Array.isArray(data) || data.length === 0) return [];

	const allTimestamps = getAllTimestamps(startTime, interval);
	const parsedData = allTimestamps.map((ts) => {
		const countData = data.find((d) => `${d.minute_range}Z` === ts);
		if (!countData || typeof countData !== 'object') {
			return {
				events: 0,
				minute: ts,
				aboveAvgPercent: 0,
			};
		} else {
			const aboveAvgCount = countData.log_count - avg;
			const aboveAvgPercent = parseInt(((aboveAvgCount / avg) * 100).toFixed(2));
			return {
				events: countData.log_count,
				minute: `${countData.minute_range}Z`,
				aboveAvgPercent,
			};
		}
	});

	return parsedData;
};

function ChartTooltip({ payload }: ChartTooltipProps) {
	if (!payload || (Array.isArray(payload) && payload.length === 0)) return null;

	const { minute, aboveAvgPercent, events } = payload[0]?.payload || {};
	const isAboveAvg = aboveAvgPercent > 0;
	const startTime = dayjs(minute).utc(true);
	const endTime = dayjs(minute).add(60, 'seconds');
	return (
		<Paper px="md" py="sm" withBorder shadow="md" radius="md">
			<Text fw={600} mb={5}>
				{`${startTime.format('HH:mm:ss A')} - ${endTime.format('HH:mm:ss A')}`}
			</Text>
			<Stack style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
				<Text>Events</Text>
				<Text>{events}</Text>
			</Stack>
			<Stack mt={4} style={{ flexDirection: 'row', justifyContent: 'center' }}>
				<Text size="sm" c={isAboveAvg ? 'red.6' : 'green.8'}>{`${isAboveAvg ? '+' : ''}${aboveAvgPercent}% ${
					isAboveAvg ? 'above' : 'below'
				} avg (Last 30 mins)`}</Text>
			</Stack>
		</Paper>
	);
}

const EventTimeLineGraph = () => {
	const { fetchQueryMutation } = useQueryResult();
	const [currentStream] = useAppStore((store) => store.currentStream);
	const [{interval, startTime, endTime}] = useLogsStore(store => store.timeRange)

	useEffect(() => {
		console.log({currentStream, startTime, endTime}, "po9")
		if (!currentStream || currentStream.length === 0) return;

		const logsQuery = {
			streamName: currentStream,
			startTime,
			endTime,
			access: [],
		};
		const query = generateCountQuery(currentStream, startTime.toISOString(), endTime.toISOString());
		fetchQueryMutation.mutate({
			logsQuery,
			query,
		});
	}, [currentStream, startTime.toISOString(), endTime.toISOString()]);

	const isLoading = fetchQueryMutation.isLoading;
	const avgEventCount = useMemo(() => calcAverage(fetchQueryMutation?.data), [fetchQueryMutation?.data]);
	const graphData = useMemo(
		() => parseGraphData(fetchQueryMutation?.data, avgEventCount, dayjs(startTime), interval),
		[fetchQueryMutation?.data, interval],
	);
	const hasData = Array.isArray(graphData) && graphData.length !== 0;
	const [, setLogsStore] = useLogsStore((store) => store.timeRange);
	const setTimeRangeFromGraph = useCallback((barValue: any) => {
		const activePayload = barValue?.activePayload;
		if (!Array.isArray(activePayload) || activePayload.length === 0) return;

		const samplePayload = activePayload[0];
		if (!samplePayload || typeof samplePayload !== 'object') return;

		const { minute } = samplePayload.payload || {};
		const startTime = dayjs(minute);
		const endTime = dayjs(minute).add(60, 'seconds');
		setLogsStore((store) =>
			setTimeRange(store, { type: 'custom', startTime: startTime, endTime: endTime }),
		);
	}, []);

	return (
		<Stack className={classes.graphContainer}>
			<Skeleton
				visible={fetchQueryMutation.isLoading}
				h="100%"
				w={isLoading ? '98%' : '100%'}
				style={isLoading ? { marginLeft: '1.8rem', alignSelf: 'center' } : !hasData ? { marginLeft: '1rem' } : {}}>
				{hasData ? (
					<AreaChart
						h="100%"
						w="100%"
						data={graphData}
						dataKey="minute"
						series={[{ name: 'events', color: 'indigo.5', label: 'Events' }]}
						tooltipProps={{
							content: ({ label, payload }) => <ChartTooltip label={label} payload={payload} />,
							position: { y: -20 },
						}}
						valueFormatter={(value) => new Intl.NumberFormat('en-US').format(value)}
						withXAxis={false}
						withYAxis={hasData}
						yAxisProps={{ tickCount: 2, tickFormatter: (value) => `${HumanizeNumber(value)}` }}
						referenceLines={[{ y: avgEventCount, color: 'red.6', label: 'Avg' }]}
						tickLine="none"
						areaChartProps={{ onClick: setTimeRangeFromGraph, style: { cursor: 'pointer' } }}
						gridAxis="xy"
						fillOpacity={0.5}
					/>
				) : (
					<NoDataView />
				)}
			</Skeleton>
		</Stack>
	);
};

export default EventTimeLineGraph;