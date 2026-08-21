import { Component, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallbackTitle?: string;
}

interface State {
    hasError: boolean;
    errorMessage: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, errorMessage: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return {
            hasError: true,
            errorMessage: error.message || 'An unexpected rendering error occurred.'
        };
    }

    handleReset = (): void => {
        this.setState({ hasError: false, errorMessage: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            return (
                <div role="alert" className="alert alert-danger" style={{ margin: '1rem 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <strong>{this.props.fallbackTitle || 'Component Error'}:</strong>
                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                                A controlled rendering issue occurred. You can retry without losing your page context.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={this.handleReset}
                            className="btn btn-secondary btn-sm"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
