import type { JSX } from "react/jsx-runtime";

export default function ListItemButton(props: {
  onClick?: () => void;
  children?: React.ReactNode;
}): JSX.Element {
  const { onClick, children } = props;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-lg shadow p-3 flex items-center justify-between hover:ring-1 hover:ring-indigo-100"
    >
      {children}
    </button>
  );
}
