// ----- Shared File Explanation Synthesizer -----
// Used by Architecture and Dependencies tabs to generate a brief explanation for each file.
export const getBriefExplanation = (filename, path, backendSummary) => {
  if (backendSummary && backendSummary.length > 5 && !backendSummary.startsWith('File: ')) {
    const sentence = backendSummary.split(/\.\s+/)[0]?.trim();
    if (sentence && sentence.length > 10) {
      return sentence.endsWith('.') ? sentence : sentence + '.';
    }
  }

  const name = filename.toLowerCase();
  const p = path.toLowerCase();

  if (name === 'package.json') return 'Manifest file managing project metadata, dependencies, scripts, and versioning.';
  if (name === 'package-lock.json') return 'Lockfile ensuring consistent and reproducible node module installation.';
  if (name === 'postcss.config.js') return 'Configuration file for PostCSS plugins like Tailwind CSS autoprefixing.';
  if (name === 'readme.md') return 'Markdown documentation describing the project setup, usage, and structure.';
  if (name === 'tailwind.config.js') return 'Configuration file for Tailwind CSS utility class generation and styling themes.';
  if (name === 'vite.config.js' || name === 'vite.config.ts') return 'Build and plugins configuration registry for the Vite dev server.';
  if (name === 'index.html') return 'The main entry point HTML document that mounts the React frontend application.';
  if (name === 'app.js' || name === 'app.jsx') return 'Core React component managing main routes, status updates, and layouts.';
  if (name === 'index.js' || name === 'index.jsx') return 'Entry point responsible for mounting the React virtual DOM tree.';
  if (name === 'index.css') return 'Global style definition sheet loading custom variables and visual transitions.';
  if (p.includes('route')) return 'Exposes routes and controller endpoints to external request clients.';
  if (p.includes('controller')) return 'Validates input, processes API requests, and formats output streams.';
  if (p.includes('service') || p.includes('util')) return 'Provides structural utilities, file parsers, or integration helpers.';
  if (p.includes('model') || p.includes('schema')) return 'Defines data schemas, entity fields, or Pydantic validation records.';
  if (name.endsWith('.py')) return `Python source code file implementing modules for ${filename}.`;
  if (name.endsWith('.js') || name.endsWith('.jsx')) return `Javascript component implementing UI logic for ${filename}.`;
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return `TypeScript source file implementing logic for ${filename}.`;

  return `Code file containing logic components for ${filename}.`;
};