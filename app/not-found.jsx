import Link from 'next/link';

export const metadata = {
  title: '404 - Page Not Found | VAWE Institute SkillWins LMS Vijayawada',
  description: 'Oops! The page you are looking for does not exist. Return to VAWE Institute - SkillWins LMS homepage to explore our software training courses in Vijayawada.',
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: '404 - Page Not Found | VAWE Institute SkillWins LMS',
    description: 'Page not found. Return to VAWE Institute - SkillWins LMS homepage.',
    url: 'https://skillwins.in/404',
  },
};

export default function NotFound() {
  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .not-found-container {
            --hue: 223;
            --sat: 10%;
            --trans-dur: 0.3s;
            background: linear-gradient(135deg, hsl(var(--hue), var(--sat), 95%) 0%, hsl(var(--hue), var(--sat), 98%) 100%);
            color: hsl(var(--hue), var(--sat), 5%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: grid;
            place-items: center;
            min-height: 100vh;
            padding: 1.5rem;
            transition: background-color var(--trans-dur), color var(--trans-dur);
          }
          .not-found-content {
            text-align: center;
            padding: 2rem 0;
          }
          .face {
            display: block;
            width: 12em;
            height: auto;
            max-width: 320px;
            margin: 0 auto 2rem;
          }
          .face__eyes,
          .face__eye-lid,
          .face__mouth-left,
          .face__mouth-right,
          .face__nose,
          .face__pupil {
            animation: eyes 1s 0.3s cubic-bezier(0.65, 0, 0.35, 1) forwards;
          }
          .face__eye-lid,
          .face__pupil {
            animation-duration: 4s;
            animation-delay: 1.3s;
            animation-iteration-count: infinite;
          }
          .face__eye-lid {
            animation-name: eye-lid;
          }
          .face__mouth-left,
          .face__mouth-right {
            animation-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
          }
          .face__mouth-left {
            animation-name: mouth-left;
          }
          .face__mouth-right {
            animation-name: mouth-right;
          }
          .face__nose {
            animation-name: nose;
          }
          .face__pupil {
            animation-name: pupil;
          }
          @keyframes eye-lid {
            from, 40%, 45%, to { transform: translateY(0); }
            42.5% { transform: translateY(17.5px); }
          }
          @keyframes eyes {
            from { transform: translateY(112.5px); }
            to { transform: translateY(15px); }
          }
          @keyframes pupil {
            from, 37.5%, 40%, 45%, 87.5%, to {
              stroke-dashoffset: 0;
              transform: translate(0, 0);
            }
            12.5%, 25%, 62.5%, 75% {
              stroke-dashoffset: 0;
              transform: translate(-35px, 0);
            }
            42.5% {
              stroke-dashoffset: 35;
              transform: translate(0, 17.5px);
            }
          }
          @keyframes mouth-left {
            from, 50% { stroke-dashoffset: -102; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes mouth-right {
            from, 50% { stroke-dashoffset: 102; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes nose {
            from { transform: translate(0, 0); }
            to { transform: translate(0, 22.5px); }
          }
          @media (prefers-color-scheme: dark) {
            .not-found-container {
              background: linear-gradient(135deg, hsl(var(--hue), var(--sat), 5%) 0%, hsl(var(--hue), var(--sat), 8%) 100%);
              color: hsl(var(--hue), var(--sat), 95%);
            }
          }
        `
      }} />

      <div className="not-found-container">
        <div className="not-found-content">
          <svg 
            className="face" 
            viewBox="0 0 320 380" 
            width="320px" 
            height="380px" 
            aria-label="A 404 becomes a face, looks to the sides, and blinks. The 4s slide up, the 0 slides down, and then a mouth appears."
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="25"
            >
              <g className="face__eyes" transform="translate(0, 112.5)">
                <g transform="translate(15, 0)">
                  <polyline className="face__eye-lid" points="37,0 0,120 75,120" />
                  <polyline className="face__pupil" points="55,120 55,155" strokeDasharray="35 35" />
                </g>
                <g transform="translate(230, 0)">
                  <polyline className="face__eye-lid" points="37,0 0,120 75,120" />
                  <polyline className="face__pupil" points="55,120 55,155" strokeDasharray="35 35" />
                </g>
              </g>
              <rect className="face__nose" rx="4" ry="4" x="132.5" y="112.5" width="55" height="155" />
              <g strokeDasharray="102 102" transform="translate(65, 334)">
                <path className="face__mouth-left" d="M 0 30 C 0 30 40 0 95 0" strokeDashoffset="-102" />
                <path className="face__mouth-right" d="M 95 0 C 150 0 190 30 190 30" strokeDashoffset="102" />
              </g>
            </g>
          </svg>

          <div className="mt-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
              Page Not Found
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto px-4">
              Oops! The page you&apos;re looking for doesn&apos;t exist. 
              It might have been moved or deleted. Let&apos;s get you back on track.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
            <Link 
              href="/" 
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
            >
              <span>←</span> Go to Homepage
            </Link>
            <Link 
              href="/courses" 
              className="inline-flex items-center gap-2 px-8 py-3 bg-transparent border-2 border-gray-400 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300"
            >
              Browse Courses
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
