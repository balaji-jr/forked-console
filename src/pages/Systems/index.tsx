import { Box } from '@mantine/core';
import { FC } from 'react';
import QuerierStats from './Querier';

const AccessMangement: FC = () => {
	return (
		<Box
			style={{
				display: 'flex',
				width: '100%',
			}}>
				<QuerierStats />
		</Box>
	);
};

export default AccessMangement;
