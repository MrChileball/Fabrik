export type PrinterNode = {
	id: string;
	name: string;
	createdAt: number;
};

export type PrinterConfig = {
	id: string;
	name: string;
	baseUrl: string;
	nodeId: string;
	createdAt: number;
};

export type StateVariant = 'printing' | 'idle' | 'paused' | 'complete' | 'error' | 'unknown';

export type PrinterStateSummary = {
	label: string;
	variant: StateVariant;
	progress: number | null;
	fetching: boolean;
	error: string | null;
	updatedAt: number | null;
	message: string | null;
};

export type StoredPrinterState = Omit<PrinterStateSummary, 'fetching'>;

export type PrinterSnapshot = {
	nodes: PrinterNode[];
	printers: PrinterConfig[];
	states?: Record<string, StoredPrinterState>;
	updatedAt: number;
};
