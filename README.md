# RAP Analyzer — Rule Against Perpetuities Visualization Tool

<div align="center">
  <a href="https://evank28.github.io/rule-against-perpetuities-visualized/">
    <img src="https://img.shields.io/badge/Access%20Deployed%20Site-Launch%20RAP%20Analyzer-blue?style=for-the-badge&logo=appveyor" alt="Deployed Website"/>
  </a>
</div>

## What It Does & How It Works

**RAP Analyzer** is an interactive, web-based legal education tool designed to help law students visualize and understand the Rule Against Perpetuities (RAP).

The application allows users to:
- **Input Natural Language**: Enter wills and trust creations natively (e.g., "To A for life, then to B's first-born child").
- **Generate Visualizations**: Automatically generate an interactive family tree and interest timeline.
- **Perform Legal Analysis**: Evaluate the validity of future interests under three distinct frameworks:
  - **Classic RAP**: The traditional common law rule.
  - **Cy Pres Doctrine**: Reforming invalid interests to effectuate the grantor's intent.
  - **USRAP (Wait-and-See)**: Validating an interest if it actually vests within 90 years.

A robust natural language parser combined with a deterministic legal analysis engine ensures accurate results, and the intuitive UI provides clear, plain-English explanations.

## Local Development

To run the application locally on your machine, follow these steps:

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed along with `npm`.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/evank28/rule-against-perpetuities-visualized.git
   cd rule-against-perpetuities-visualized
   ```
2. Install all dependencies:
   ```bash
   npm install
   ```

### Running the App
Start the Vite development server:
```bash
npm run dev
```

The application will be accessible at `http://localhost:5173/` (or another port outputted to the console).

## Contributing

We welcome contributions! If you'd like to improve the RAP Analyzer, follow these steps:
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/my-new-feature`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/my-new-feature`).
5. Open a Pull Request.

Please create an issue if you discover any bugs or have feature suggestions. All legal logic additions should include test cases covering their specific scenarios.
