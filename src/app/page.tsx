// src/app/page.tsx
'use client';

import Header from '@/components/Header';
import ReportsTable from '@/components/ReportsTable';

export default function Home() {
  const handleSearch = (query: string) => {
    // TODO: Implement search functionality
    console.log('Searching for:', query);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="bg-[#581C87] text-white p-4 mb-6">
          <h1 className="text-2xl font-bold">
            On-Demand Eligibility Extracts
          </h1>
        </div>
        
        <ReportsTable />
      </main>
      
      <footer className="bg-gray-100 py-4">
        <div className="container mx-auto px-4 text-center text-gray-600">
          © 2025 On-Demand Eligibility Extracts. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
