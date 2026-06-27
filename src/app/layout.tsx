import "./globals.css";

export const metadata = {
  title: "Broadcast Console",
  description: "WhatsApp broadcast console — NazzilVideo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // suppressHydrationWarning on <html>: the pre-paint theme script sets
  // data-theme, which intentionally differs from the server markup.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Schibsted+Grotesk:wght@500;600;700;800;900&family=Cairo:wght@400;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Apply saved theme before paint to avoid a flash (dark is default). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('bc-theme')==='light')document.documentElement.dataset.theme='light'}catch(e){}",
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
