import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <h2 className="text-2xl font-heading font-bold mb-6">Division E - District 229</h2>
            <p className="text-gray-400 max-w-md text-sm leading-6">
              Empowering leaders across Chennai through public speaking and leadership excellence. Part of District 229, Toastmasters International.
            </p>
          </div>
          <div>
            <h3 className="font-bold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="#events" className="hover:text-ti-yellow">Events</Link></li>
              <li><Link href="#notices" className="hover:text-ti-yellow">Notice Board</Link></li>
              <li><Link href="#resources" className="hover:text-ti-yellow">Resource Vault</Link></li>
              <li><Link href="#directory" className="hover:text-ti-yellow">Directory</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold mb-4">Policies</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link href="#" className="hover:text-ti-yellow">POSH Policy</Link></li>
              <li><Link href="#" className="hover:text-ti-yellow">Safety Guidelines</Link></li>
              <li><Link href="#" className="hover:text-ti-yellow">Disclaimer</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-800 text-xs text-gray-500 space-y-4">
          <p>
            The information on this website is for the sole use of Toastmasters' members, for Toastmasters business only. 
            It is not to be used for solicitation and commercial purposes.
          </p>
          <p>
            Toastmasters International and the Toastmasters International logo are trademarks and service marks of 
            Toastmasters International, registered in the US and other countries.
          </p>
          <p className="text-center mt-8">
            © {new Date().getFullYear()} Division E, District 229. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
