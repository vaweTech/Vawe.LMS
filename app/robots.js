export default function robots() {
  const base = 'https://skillwins.in';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/Admin/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}


