export default async function sitemap() {
  const baseUrl = 'https://skillwins.in';
  const staticRoutes = [
    '',
    '/courses',
    '/contact',
    '/pricing',
    '/placement',
    '/blog',
    '/practice',
    '/main',
  ];

  const now = new Date().toISOString();

  return staticRoutes.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: path === '' ? 1.0 : 0.7,
  }));
}


