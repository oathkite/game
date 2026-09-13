import { useLanguage } from "@/i18n/locale";
/** Wind is a simulation value, not a physical speed in m/s. */
export const WindGauge = ({ wind }: { readonly wind: number }) => {
  const { t } = useLanguage();
  const direction = wind < 0 ? "左向きの風" : wind > 0 ? "右向きの風" : "無風";
  return <div className="battle-wind" role="img" aria-label={`${t(direction)} ${Math.abs(wind)}`} data-direction={Math.sign(wind)}>
    <svg className="battle-wind-cloud" viewBox="0 0 32 24" aria-hidden="true" shapeRendering="crispEdges">
      <path fill="#79b4dd" d="M2 12h4V8h4V4h10v3h5v5h4v3h2v5h-4v2H6v-2H2z" />
      <path fill="#d6edff" d="M4 12h4V8h4V4h7v3h5v6h4v5h-6v2H8v-3H4z" />
      <path fill="#fff" d="M9 8h3V5h6v3h3v3h-5V9H9zM4 13h4v3H4z" />
      <path fill="#acd3ee" d="M10 17h5v3h-5zm10-5h4v5h-4z" />
    </svg>
    <svg className="battle-wind-arrow" viewBox="0 0 32 24" aria-hidden="true" shapeRendering="crispEdges">
      {wind === 0 ? <path d="M8 10h16v4H8z" fill="#9dafbc" /> : <path transform={wind < 0 ? "translate(32 0) scale(-1 1)" : undefined} d="M2 9h17V3h3v3h3v3h3v3h3v1h-3v3h-3v3h-3v3h-3v-7H2z" fill="#c1e6ff" />}
    </svg>
    <b>{Math.abs(wind)}</b>
  </div>;
};
