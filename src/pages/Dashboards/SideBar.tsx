import { DASHBOARDS_SIDEBAR_WIDTH } from '@/constants/theme';
import { Button, Stack, Text } from '@mantine/core';
import classes from './styles/sidebar.module.css';
import { IconPlus } from '@tabler/icons-react';
import { useDashboardsStore, dashboardsStoreReducers } from './providers/DashboardsProvider';
import { useCallback } from 'react';
import _ from 'lodash';
import { Dashboard } from '@/@types/parseable/api/dashboards';

const { selectDashboard, toggleCreateDashboardModal } = dashboardsStoreReducers;
interface DashboardItemProps extends Dashboard {
	activeDashboardId: undefined | string;
	onSelect: (id: string) => void;
}

const DashboardListItem = (props: DashboardItemProps) => {
	const { name, dashboard_id, tiles, activeDashboardId, onSelect } = props;
	const totalTiles = _.size(tiles);
	const isActive = dashboard_id === activeDashboardId;

	const selectDashboard = useCallback(() => {
		!isActive && onSelect(dashboard_id);
	}, [isActive]);
	return (
		<Stack gap={0} className={`${classes.dashboardItem} ${isActive ? classes.active : ''}`} onClick={selectDashboard}>
			<Text className={classes.dashboardTitle} lineClamp={1}>
				{name}
			</Text>
			<Text className={classes.tilesCountText}>{`${totalTiles} Tile${totalTiles === 1 ? '' : 's'}`}</Text>
		</Stack>
	);
};

const DashboardList = () => {
	const [dashboards, setDashbaordsStore] = useDashboardsStore((store) => store.dashboards);
	const [activeDashboardId] = useDashboardsStore((store) => store.activeDashboard?.dashboard_id);

	const onSelectDashboardId = useCallback(
		(dashboardId: string) => {
			if (activeDashboardId === dashboardId) return;

			setDashbaordsStore((store) => selectDashboard(store, dashboardId));
		},
		[activeDashboardId],
	);

	return (
		<Stack style={{ flex: 1, overflowY: 'scroll' }}>
			{_.map(dashboards, (dashboard) => {
				return (
					<DashboardListItem
						key={dashboard.dashboard_id}
						{...dashboard}
						activeDashboardId={activeDashboardId}
						onSelect={onSelectDashboardId}
					/>
				);
			})}
		</Stack>
	);
};

const SideBar = () => {
	const [dashboards, setDashbaordsStore] = useDashboardsStore((store) => store.dashboards);

	const openCreateStreamModal = useCallback(() => {
		setDashbaordsStore((store) => toggleCreateDashboardModal(store, true));
	}, []);

	if (_.isEmpty(dashboards)) return null;

	return (
		<Stack style={{ width: DASHBOARDS_SIDEBAR_WIDTH }} className={classes.container}>
			<Stack style={{ padding: '0.75rem', paddingBottom: 0, justifyContent: 'center' }}>
				<Button
					variant="outline"
					className={classes.createDashboardBtn}
					onClick={openCreateStreamModal}
					leftSection={<IconPlus stroke={2} size={'1rem'} />}>
					New Dashboard
				</Button>
			</Stack>
			<DashboardList />
		</Stack>
	);
};

export default SideBar;