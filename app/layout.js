import "./globals.css";

export const metadata = { title: "ADMINメール" };

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body className="bg-slate-100 text-slate-800 antialiased">{children}</body>
    </html>
  );
}
