export interface ComplianceDoc {
  id: string;
  title: string;
  category: string;
  lastUpdated: string;
  description: string;
  contentHtml: string;
}

export const COMPLIANCE_DOCS: ComplianceDoc[] = [
  {
    id: 'globalport',
    title: 'Global Port Compliance & Record Custody Manual',
    category: 'Supply Chain & Global Customs',
    lastUpdated: 'May 2026',
    description: 'Guidelines for managing corporate ledgers, commercial invoices, and tariff inventory reports under international port authority regulations.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. Global Port Compliance Framework</h4>
        <p>
          International Port Authorities enforce strict corporate governance, records keeping, customs tariff reporting, and audit rules for all importing and exporting entities. Under modern trade regulations, companies must maintain accurate corporate books, commercial transaction sheets, and warehouse inventory counts completely transparently.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Local-Compute Alignment</h4>
        <p>
          <strong>Datum-S.Space</strong> enables seamless compliance with global port audit requirements by processing all customs listings and supply chain worksheets directly in-browser. Since no raw corporate invoices or import records cross network bounds, sensitive international commercial transactions are protected against external leaks.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">3. International Corridors & Supply Chain Optimization</h4>
        <p>
          The platform equips logistics operators with <strong>Rajesh & Tareq (Global Supply Chain Specialists)</strong>, customized to international logistics corridors. This agent evaluates transit bottleneck cycles, STOCKOUT risk, and Return to Origin (RTO) anomalies.
        </p>

        <div class="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
          <strong class="text-[10px] text-brand-500 font-extrabold uppercase">📌 Mandatory Compliance Checklist:</strong>
          <ul class="list-disc pl-4 space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
            <li>Ensure all imported shipment CSVs or Excel formats are audited locally.</li>
            <li>Maintain backups of port warehouse records outside temporary browser cache.</li>
            <li>Use the SQL query workbench to reconcile shipping registers against customs declarations.</li>
          </ul>
        </div>
      </div>
    `
  },
  {
    id: 'bol',
    title: 'Bill of Lading (BoL) Manifest Ingestion & Custody Standard',
    category: 'Logistics Operations',
    lastUpdated: 'May 2026',
    description: 'Protocol for scanning, flattening, and importing marine and freight Bill of Lading (BoL) manifests in compliance with FIATA standards.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. Bill of Lading Cargo Manifest Rules</h4>
        <p>
          The Bill of Lading (BoL) is a legal document issued by a carrier to a shipper that details the type, quantity, and destination of the goods being carried. Modern digital freight logistics requires high-speed parsing of multi-column, multi-level freight manifests in strict compliance with FIATA (International Federation of Freight Forwarders Associations) and UN/EDIFACT cargo standards.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Ingesting Complex Freight Layouts</h4>
        <p>
          Shipping documents often contain messy layouts, including group banners, variable row offsets, and nested tables. Datum-S.Space offers two distinct ingestion gateways:
        </p>
        <ul class="list-disc pl-4 space-y-1">
          <li><strong>Structured Spreadsheet Ingestion</strong>: For tabular BoL manifests with fixed header alignments.</li>
          <li><strong>Unstructured Ingestion (Hierarchical Flattening)</strong>: For freight spreadsheets containing top-level group banners and nested sub-columns. The platform uses a cell-propagation algorithm to combine sparse group titles into clean column headers (e.g., <code>CARRIER_INFO_CONTAINER_NUM</code>) for seamless SQL querying.</li>
        </ul>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">3. Local OCR Processing</h4>
        <p>
          By utilising local Tesseract OCR, freight clerks can extract cargo manifest texts from scanned PDF printouts completely in-browser without sending shipping records to commercial PDF APIs, preventing competitor snooping.
        </p>
      </div>
    `
  },
  {
    id: 'ifrs',
    title: 'IFRS Financial Reconciliation & Audit Standards Manual',
    category: 'Finance & Compliance',
    lastUpdated: 'May 2026',
    description: 'Administrative procedures for verifying asset statements, ledger compliance, and ledger sanitizations in compliance with IASB guidelines.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. IFRS Administrative Requirements</h4>
        <p>
          Under the International Financial Reporting Standards (IFRS) and International Accounting Standards (IAS), financial auditors must maintain high transaction transparency. Reconciliations, transaction adjustments, and corrections to accounting estimations (IAS 8) require complete audit integrity.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Dynamic Forensic Auditing Tools</h4>
        <p>
          The platform equips financial departments with **Inspector Vance (Forensic Financial Auditor)** to automate sheet compliance. This agent scans accounting registers and alerts the user to:
        </p>
        <ul class="list-disc pl-4 space-y-1">
          <li>GST/tax calculation anomalies and VAT mismatched percentages.</li>
          <li>Double-billing issues and transactions recorded at unusual times (weekends, off-hours).</li>
          <li>Ledger adjustments and high-deviation transaction entries.</li>
        </ul>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">3. Tamper-Evident History & Safe rollbacks</h4>
        <p>
          All operations run on in-memory DuckDB sandboxes. If a destructive adjustment query is executed, the user can instantly verify the new row count and roll back the changes to revert the ledger to its pre-adjustment baseline.
        </p>
      </div>
    `
  },
  {
    id: 'secfinra',
    title: 'SEC & FINRA Security Compliance & Data Custody Protocol',
    category: 'Finance & Security',
    lastUpdated: 'May 2026',
    description: 'Protocol for securing trading registers, recordkeeping compliance under SEC Rule 17a-4, and tamper-resistant audit trails.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. SEC Rule 17a-4 & FINRA Rule 4511 Recordkeeping</h4>
        <p>
          US financial institutions regulated by the Securities and Exchange Commission (SEC) and the Financial Industry Regulatory Authority (FINRA) are subject to stringent recordkeeping rules. Broker-dealers must retain all transaction registers, books of account, and communication logs in non-erasable, non-rewriteable (WORM) storage.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Local-Compute Isolation</h4>
        <p>
          Datum-S.Space ensures compliance with data isolation requirements by processing trade worksheets completely locally. Because no raw transaction files or portfolio sheets leave the operator's browser session, sensitive client holdings are protected against leakage.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">3. Hardening for SEC/FINRA Compliance</h4>
        <p>
          While the platform's <strong>Audit Dossier</strong> records all operations, browser <code>localStorage</code> is vulnerable to manual deletion. For formal broker-dealer compliance, the enterprise operator must integrate the platform's EventBus directly with an external immutable cloud log aggregator.
        </p>
      </div>
    `
  },
  {
    id: 'hipaa',
    title: 'HIPAA Protected Health Information (PHI) Security Manual',
    category: 'Healthcare & Security',
    lastUpdated: 'May 2026',
    description: 'Standard operating procedures for managing patient data (PHI) inside client-side compute boundaries.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. HIPAA PHI Security Regulations</h4>
        <p>
          The US Health Insurance Portability and Accountability Act (HIPAA) mandates absolute security and privacy controls for Protected Health Information (PHI). Sending raw medical records, patient lists, or diagnostic sheets to unsecured cloud databases is a severe federal offense.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Zero-Cloud Leakage Compliance</h4>
        <p>
          Datum-S.Space is exceptionally well-suited for healthcare analytics. Because all dataset operations, query compilations, and OCR document scans run entirely locally in the browser's sandbox:
        </p>
        <ul class="list-disc pl-4 space-y-1">
          <li><strong>No PHI Transmitted</strong>: No health details ever cross network boundaries to a database host.</li>
          <li><strong>No BAA Required</strong>: Since the hosting server does not process or see patient records, no complex Business Associate Agreements (BAAs) are required for the host server.</li>
        </ul>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">3. Mandatory Health Operator Guidelines</h4>
        <p>
          To prevent HIPAA violations:
        </p>
        <ul class="list-disc pl-4 space-y-1 text-red-500">
          <li>Do NOT type PHI details into the chat if you have set your provider to a cloud API (Gemini, Groq, Mistral) without establishing a signed BAA with those providers.</li>
          <li>Enforce <strong>Local Compute Mode</strong> inside Settings for all patient-related text operations.</li>
        </ul>
      </div>
    `
  },
  {
    id: 'gdpr',
    title: 'GDPR Data Minimization & PII Sanitization Guide',
    category: 'Privacy & Governance',
    lastUpdated: 'May 2026',
    description: 'Guidelines for executing PII audits, masking data keys, and enforcing GDPR compliance completely locally.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. GDPR Privacy Regulations</h4>
        <p>
          The EU General Data Protection Regulation (GDPR) mandates strict data minimization, user consent, and data protection by design. Organizations processing EU citizen records must secure and redact exposed personally identifiable information (PII).
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Local PII Audits & One-Click Masking</h4>
        <p>
          The platform incorporates the <strong>Privacy Lab</strong>, which allows compliance officers to scan datasets for:
        </p>
        <ul class="list-disc pl-4 space-y-1">
          <li>Exposed email coordinates (automatically masked as <code>ad***@domain.com</code>).</li>
          <li>exposed phone number digits (automatically masked as <code>050******123</code>).</li>
          <li>exposed credit card footings (automatically masked as <code>****-****-****-9876</code>).</li>
        </ul>
        <p>
          All scans and modifications occur in-browser. This ensures no unmasked PII ever exits to local reporting drives, maintaining 100% compliance.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">3. Right to Be Forgotten Integration</h4>
        <p>
          Since data is temporary in browser memory, clearing the browser cache or dropping the table instantly deletes all local traces of records from the machine, satisfying the "Right to be Forgotten" with zero database sync delays.
        </p>
      </div>
    `
  },
  {
    id: 'iso27001',
    title: 'ISO/IEC 27001 Information Security Management Standard',
    category: 'Information Security',
    lastUpdated: 'May 2026',
    description: 'Framework mapping client-side compute bounds, encryption keys, and air-gapped sandboxing controls to ISO 27001 guidelines.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. ISO/IEC 27001 Alignment</h4>
        <p>
          ISO/IEC 27001 is the leading international standard focused on information security management systems (ISMS). It provides organizations with requirements for establishing, implementing, maintaining, and continually improving information security.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Secure Air-Gapped Compute</h4>
        <p>
          Datum-S.Space aligns with key ISO 27001 control families—specifically around operational security and access control—by keeping all active datasets enclosed in local browser memory. By avoiding server-side database persistence, the system reduces the organization's network attack surface:
        </p>
        <ul class="list-disc pl-4 space-y-1">
          <li><strong>Data Leakage Prevention (A.12.6.1)</strong>: In-memory computations ensure raw files are never transmitted to unauthorized systems.</li>
          <li><strong>Cryptographic Controls (A.10.1)</strong>: Locally loaded datasets can be processed using client-side security policies, matching zero-trust guidelines.</li>
        </ul>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">3. Continuous Security Hardening</h4>
        <p>
          All operations dispatches are monitored via the local EventBus. Integrations with corporate Security Operations Centers (SOCs) can easily capture telemetry metadata while keeping raw financial, logistics, and corporate records air-gapped.
        </p>
      </div>
    `
  },
  {
    id: 'soc2',
    title: 'SOC 2 Type II Security & Trust Principles Framework',
    category: 'Security & Trust',
    lastUpdated: 'May 2026',
    description: 'Documentation on platform compliance with SOC 2 Trust Services Criteria for Security, Availability, and Confidentiality.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. SOC 2 Trust Principles</h4>
        <p>
          SOC 2 specifies criteria for managing customer data based on five "trust service principles"—security, availability, processing integrity, confidentiality, and privacy.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Processing Integrity & Confidentiality</h4>
        <p>
          The architecture of Datum-S.Space natively accommodates these trust principles:
        </p>
        <ul class="list-disc pl-4 space-y-1">
          <li><strong>Confidentiality</strong>: No external server has view access to loaded spreadsheets, ensuring absolute proprietary commercial confidentiality.</li>
          <li><strong>Processing Integrity</strong>: High-fidelity calculations are executed via local DuckDB engines, ensuring transactional accuracy with transparent audit trails inside the Audit Dossier.</li>
        </ul>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">3. Enterprise Audit Log Export</h4>
        <p>
          To maintain SOC 2 compliance for external auditors, users can leverage the real-time export tools in the **Audit Dossier** to download signed execution logs verifying the zero-cloud processing integrity of all analytics workflows.
        </p>
      </div>
    `
  },
  {
    id: 'ccpa',
    title: 'CCPA California Consumer Privacy Act Standard',
    category: 'Privacy & Governance',
    lastUpdated: 'May 2026',
    description: 'Protocol for managing personal information, consumer rights, and local database sanitization compliance under CCPA guidelines.',
    contentHtml: `
      <div class="space-y-4 font-sans text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800 pb-2">1. CCPA Data Compliance</h4>
        <p>
          The California Consumer Privacy Act (CCPA) grants consumers robust rights over their personal information, including the right to know, the right to delete, and the right to opt-out of the sale of personal information.
        </p>

        <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">2. Zero Data-Selling Architecture</h4>
        <p>
          Because Datum-S.Space operates as a serverless analytical interface running locally in the client browser, it simplifies CCPA compliance:
        </p>
        <ul class="list-disc pl-4 space-y-1">
          <li><strong>No Data Sales/Sharing</strong>: Since raw files and queries are processed entirely inside the local browser context, no customer information is sold, shared, or compiled for marketing.</li>
          <li><strong>Immediate Deletion Controls</strong>: Drops and modifications of operational worksheets require no server wait periods, satisfying the right to delete immediately.</li>
        </ul>
      </div>
    `
  }
];
