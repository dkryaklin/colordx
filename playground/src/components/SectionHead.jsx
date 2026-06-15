export default function SectionHead({ icon, eyebrow, title, desc }) {
  return (
    <div className="section-head">
      <span className="section-eyebrow">
        {icon}
        {eyebrow}
      </span>
      <h2 className="section-title">{title}</h2>
      {desc ? <p className="section-desc">{desc}</p> : null}
    </div>
  );
}
