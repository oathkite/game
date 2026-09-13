import { useLanguage } from "@/i18n/locale";

/** A small pixel silhouette, shared by the lobby and introductory screen. */
export const TankPortrait = () => {
  const { t } = useLanguage();
  return <div className="tank-portrait" data-loaded="true" role="img" aria-label={t("機体")}>
    <svg viewBox="0 0 80 55" aria-hidden="true" shapeRendering="crispEdges" style={{ width: "100%", height: "100%", display: "block" }}>
      <g fill="#33ff66">
        <path d="M12 35h52v4h4v10h-4v4H12v-4H8V39h4z M20 27h36v8H20z M28 19h20v8H28z M44 19h24v4H44z" />
      </g>
      <path d="M16 41h8v6h-8z M28 41h8v6h-8z M40 41h8v6h-8z M52 41h8v6h-8z" fill="#000" />
    </svg>
  </div>;
};
