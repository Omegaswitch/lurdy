import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// The HTML shell of the web build (static). The app is Czech: the document language matters for screen readers.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="cs">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#e31818" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
