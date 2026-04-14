import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <body style={{ margin: 0, padding: 0, overflowX: "hidden" }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
