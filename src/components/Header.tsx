'use client'
import Link from 'next/link'
import { useState } from 'react'
import CreateReportFlow from './CreateReportFlow'

export default function Header() {
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const handleCreateReport = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsCreateModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsCreateModalOpen(false)
  }

  return (
    <>
      <header className="header">
        <div className="container mx-auto">
          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <div className="h-12 w-48 flex items-center justify-center">
                <img src="/point32health.svg" alt="Company Logo" />
              </div>
              Welcome, Rahul Joglekar
            </div>
            <nav className="flex gap-6 items-center">
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-800"
              >
                On-Demand Eligibility Extracts
              </Link>
              <Link
                href="#"
                className="text-blue-600 hover:text-blue-800"
                onClick={handleCreateReport}
              >
                Create Extract
              </Link>
              <div className="dropdown">
                <button 
                  className="text-blue-600 hover:text-blue-800"
                  onMouseEnter={() => setIsHelpOpen(true)}
                  onMouseLeave={() => setIsHelpOpen(false)}
                >
                  HELP ▼
                </button>
                <div 
                  className="dropdown-content"
                  onMouseEnter={() => setIsHelpOpen(true)}
                  onMouseLeave={() => setIsHelpOpen(false)}
                >
                  <Link
                    href="#"
                    className="block px-4 py-2 text-gray-800 hover:bg-gray-200"
                  >
                    User Guide
                  </Link>
                </div>
              </div>
            </nav>
          </div>
        </div>
      </header>

      {isCreateModalOpen && (
        <CreateReportFlow onClose={handleCloseModal} />
      )}
    </>
  )
}