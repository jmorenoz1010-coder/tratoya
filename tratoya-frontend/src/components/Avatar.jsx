export default function Av({ name = "", size = 34 }) {
  const ini = (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className="av"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {ini}
    </div>
  );
}
