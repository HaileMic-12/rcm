import "./globals.css";

export const metadata = {
  title: "Radiology Study App",
  description: "Interactive radiological anatomy flashcards and quizzes",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}