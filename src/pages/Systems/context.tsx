import type { Dispatch, FC, SetStateAction } from 'react';
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';

const Context = createContext({});

const { Provider } = Context;

interface SystemsPageProvider {
	children: ReactNode;
} 

interface LogsPageContextValue {
	state: SystemsPageContextState;
	methods: SystemsPageContextMethods;
}

type SystemsPageContextState = {
	fetchStartTime: Dayjs;
	statusFixedDurations: number;
}

type SystemsPageContextMethods = {
	resetFetchStartTime: () => void;
	setStatusFixedDurations: Dispatch<SetStateAction<number>>;
}

const SystemsPageProvider: FC<SystemsPageProvider> = ({ children }) => {
	const [fetchStartTime, setFetchStartTime] = useState<Dayjs>(dayjs());
	const [statusFixedDurations, setStatusFixedDurations] = useState<number>(0);

	const resetFetchStartTime = useCallback(() => {
		setFetchStartTime(dayjs())
	}, [])

	const state: SystemsPageContextState = {
		fetchStartTime,
		statusFixedDurations
	};

	const methods: SystemsPageContextMethods = {
		resetFetchStartTime,
		setStatusFixedDurations
	}

	const value = useMemo(() => ({ state, methods }), [state, methods]);

	return <Provider value={value}>{children}</Provider>;
};

export const useSystemsPageContext = () => useContext(Context) as LogsPageContextValue;

export default SystemsPageProvider;
