'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import attendeesData from '@/data/attendees.json';

// Types
type Attendee = {
  id: string;
  name: string;
  image: string;
  area: string;
  role: string;
  club: string;
  profession: string;
  icebreaker: string;
  linkedin: string;
  consent: boolean;
};

const AREAS = ['All', 'E1', 'E2', 'E3', 'E4'];
const ROLES = ['All', 'President', 'VPE', 'VPM', 'VPPR', 'Sec', 'Treas', 'SAA'];

export default function BreakTheIce() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All');

  // Filter logic
  const filteredAttendees = useMemo(() => {
    return (attendeesData as Attendee[]).filter((attendee) => {
      // Only display if explicit consent flag is true
      if (!attendee.consent) return false;
      
      const matchSearch =
        searchTerm === '' ||
        attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attendee.club.toLowerCase().includes(searchTerm.toLowerCase()) ||
        attendee.profession.toLowerCase().includes(searchTerm.toLowerCase());
        
      const matchArea = selectedArea === 'All' || attendee.area === selectedArea;
      const matchRole = selectedRole === 'All' || attendee.role === selectedRole;

      return matchSearch && matchArea && matchRole;
    });
  }, [searchTerm, selectedArea, selectedRole]);

  const totalConsented = (attendeesData as Attendee[]).filter(a => a.consent).length;

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-body flex flex-col relative pb-48">
      {/* 1. Permanent Header & Utility Anchors */}
      <header className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-950">
        <h1 className="font-heading font-bold text-white tracking-tight">Officers Training Program ( OTP ) Event - 4th July</h1>
        <div className="text-xs text-zinc-400 flex gap-3">
          <Link href="/agenda" className="hover:text-ti-yellow transition-colors">[ Agenda Creator ]</Link>
          <Link href="/minutes" className="hover:text-ti-yellow transition-colors">[ Minutes Tool ]</Link>
        </div>
      </header>

      {/* 2. Static Stats Counter */}
      <div className="p-4 flex justify-center border-b border-zinc-800/50 bg-zinc-900/50">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-800 rounded-full text-sm font-semibold border border-zinc-700">
          <span>💡</span>
          <span>{totalConsented} Division E Profiles Unlocked</span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-4">
        {/* 4. The Explicit Attendee Grid */}
        {filteredAttendees.length === 0 ? (
          <div className="text-center text-zinc-500 py-12">No profiles found matching your filters.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {filteredAttendees.map((attendee) => (
              <div key={attendee.id} className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden flex flex-col hover:border-ti-grey transition-colors">
                <div className="p-5 flex gap-4">
                  <div className="flex-shrink-0">
                    <Image
                      src={attendee.image}
                      alt={`Profile of ${attendee.name}`}
                      width={80}
                      height={80}
                      className="rounded-lg object-cover bg-zinc-700 border border-zinc-600"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white truncate">{attendee.name}</h2>
                    {/* Metadata Line 1: TM Identity */}
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-ti-blue text-white">
                        {attendee.area}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-ti-maroon text-white">
                        {attendee.role}
                      </span>
                    </div>
                    {/* Metadata Line 2: Professional Identity */}
                    <div className="mt-2 text-sm text-zinc-300">
                      <div className="truncate font-semibold text-ti-yellow">{attendee.club}</div>
                      <div className="truncate text-zinc-400 text-xs mt-0.5">{attendee.profession}</div>
                    </div>
                  </div>
                </div>
                
                {/* Conversational Hook */}
                <div className="px-5 pb-4">
                  <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3">
                    <p className="text-sm italic text-zinc-300">
                      <span className="font-semibold text-zinc-400 not-italic block mb-1 uppercase tracking-wider text-[10px]">Ask me about:</span>
                      "{attendee.icebreaker}"
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-auto p-5 pt-0">
                  <a
                    href={attendee.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-2.5 px-4 bg-ti-yellow text-ti-blue font-bold text-sm text-center rounded-lg hover:bg-yellow-400 transition-colors"
                  >
                    Connect on LinkedIn
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 5. Passive Feedback Footer */}
      <footer className="mt-8 border-t border-zinc-800 bg-zinc-950 p-6 text-center text-sm text-zinc-500 pb-32">
        <div className="mb-6">
          <p className="mb-3 text-zinc-400">Did this tool help you break the ice today?</p>
          <div className="flex justify-center gap-4">
            <a 
              href="mailto:pingananth@gmail.com?subject=OTP%20Event%20Tool%20Feedback&body=Yes,%20the%20tool%20was%20helpful!" 
              className="px-6 py-2 bg-zinc-800 hover:bg-ti-blue text-white rounded-md border border-zinc-700 hover:border-ti-blue transition-colors font-semibold"
            >
              Yes
            </a>
            <a 
              href="mailto:pingananth@gmail.com?subject=OTP%20Event%20Tool%20Feedback&body=No,%20the%20tool%20needs%20improvement." 
              className="px-6 py-2 bg-zinc-800 hover:bg-ti-maroon text-white rounded-md border border-zinc-700 hover:border-ti-maroon transition-colors font-semibold"
            >
              No
            </a>
          </div>
        </div>
        <p className="mb-4">© {new Date().getFullYear()} Division E, District 229. All rights reserved.</p>
        <div className="flex justify-center gap-4">
          <a href="#" className="hover:text-zinc-300">LinkedIn</a>
          <a href="#" className="hover:text-zinc-300">GitHub</a>
          <a href="#" className="hover:text-zinc-300">YouTube</a>
          <a href="#" className="hover:text-zinc-300">X</a>
          <a href="#" className="hover:text-zinc-300">Instagram</a>
        </div>
      </footer>

      {/* 3. Client-Side Controls (Docked Sticky Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-700 p-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search by Name, Club, or Profession..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-ti-yellow transition-colors"
          />
          
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {/* Area Filter */}
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ti-yellow flex-shrink-0"
            >
              <option value="" disabled>Area</option>
              {AREAS.map(area => (
                <option key={area} value={area}>{area === 'All' ? 'All Areas' : area}</option>
              ))}
            </select>

            {/* Role Filter */}
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-ti-yellow flex-shrink-0"
            >
              <option value="" disabled>Role</option>
              {ROLES.map(role => (
                <option key={role} value={role}>{role === 'All' ? 'All Roles' : role}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
