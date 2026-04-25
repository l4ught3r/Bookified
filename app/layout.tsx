import './globals.css'

import { IBM_Plex_Serif, Mona_Sans } from 'next/font/google'

import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'

const ibmPexSerif = IBM_Plex_Serif({
	subsets: ['latin'],
	variable: '--font-ibm-plex-serif',
	weight: ['400', '500', '600', '700'],
	display: 'swap'
})

const monaSans = Mona_Sans({
	subsets: ['latin'],
	variable: '--font-mona-sans',
	display: 'swap'
})

export const metadata: Metadata = {
	title: 'Bookified',
	description:
		'Transform your books into interactive AI conversations. Upload PDFs, and chat with your books using voice.'
}

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang='en'>
			<body
				className={`${ibmPexSerif.variable} ${monaSans.variable} relative font-sans antialiased`}
			>
				<ClerkProvider>
					<Navbar />
					{children}
				</ClerkProvider>
			</body>
		</html>
	)
}
