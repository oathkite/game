import { Component, type ReactNode } from "react";
type Props = { readonly children: ReactNode; readonly message: string; readonly retryLabel: string };
/** Dynamic chunks can fail after a network interruption or a deployment. */
export class SceneBoundary extends Component<Props, { readonly failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override render() {
    if (this.state.failed) return <section className="world-content" role="alert">
      <p>{this.props.message}</p>
      <button className="pixel-button" onClick={() => { const url = new URL(location.href); url.searchParams.set("sceneRetry", String(Date.now())); location.replace(url.href); }}>{this.props.retryLabel}</button>
    </section>;
    return this.props.children;
  }
}
