'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { WaitlistModal } from '@/components/homepage/WaitlistModal';

export default function HomePage() {
  const router = useRouter();
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        toast.success('Signed in successfully!');
        router.push('/viewer');
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <>
      <div className="relative flex h-screen w-screen items-stretch">
        {/* Video and overlay will be moved to the right column */}
        {/* 
      <video
        autoPlay
        loop
        muted
        playsInline // Important for mobile browsers
        className="absolute left-0 top-0 h-full w-full object-cover -z-10"
        src="/videos/Ricky-Bobby-Take3-202505221246.webm"
      >
        <source src="/your-video.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="absolute left-0 top-0 h-full w-full bg-black/50 -z-10" /> Full-screen dark overlay REMOVED 
      */}


        {/* Left Column (1/3 width) */}
        <div className="relative w-full md:w-1/3 bg-black bg-opacity-80 p-6 sm:p-8 lg:p-12 flex flex-col justify-start items-center overflow-y-auto"
             // Removed: bg-[url('/side_bar_graphic.svg')] bg-no-repeat bg-cover bg-center
             // Removed: style prop for backgroundSize and backgroundPosition
        >
          {/* New Inner Wrapper - now w-full up to max-width */}
          <div className="w-full max-w-[488px] flex flex-col items-start gap-8">
            <div> {/* Top Content Container */}
              <div className="mb-4"> {/* Changed from mb-8 to mb-4 for 16px gap */}
                <Link href="/" className="block">
                  <Image
                    src="/images/side_bar_graphic_logo.svg"
                    alt="QWK SHOT Logo"
                    width={400} // Intrinsic width (can be adjusted)
                    height={100} // Intrinsic height (maintains aspect ratio with h-auto)
                    priority
                    className="w-full h-auto" // Responsive, auto height, NOW FILLS PARENT (up to 440px)
                  />
                </Link>
              </div>

              <h1 className="use-mamoth-font text-xl leading-7 md:text-2xl md:leading-[34px] font-normal text-[#FEE3E5] mb-4">
                Super-simple LLM-powered cameraman for quick, easy hero shots and animations.
              </h1>

              <div className="mt-12"> {/* Overall Waitlist section block */}
                <div className="mb-4"> {/* "Waitlist" heading container, changed from mb-8 to mb-4 for 16px gap */}
                  <h2 className="use-mamoth-font text-5xl text-pink-100">
                    Waitlist
                  </h2>
                </div>

                {/* Container for description and button (Private Beta h3 removed) */}
                <div className="flex flex-col items-start gap-2 w-full">
                  {/* <h3 className="text-base font-extrabold text-[#FEE3E5] leading-6">Private Beta</h3> Removed this line */}
                  
                  {/* Container for paragraph and button - responsive stacking with lg breakpoint */}
                  <div className="flex flex-col items-start md:flex-row md:justify-between md:items-center lg:flex-col lg:items-start self-stretch gap-4 w-full">
                    <p className="text-[#F2F2F2] text-base font-normal leading-6 w-full md:w-auto md:flex-grow md:max-w-[200px] lg:w-full lg:max-w-none lg:flex-grow-0"> {/* Responsive width/grow/max-width */}
                      We're currently invite-only. Join the waitlist for early access and updates.
                    </p>
                    <Button 
                      variant="primary"
                      className="flex h-14 px-6 py-0 justify-start items-center gap-[10px] rounded-md bg-[#FEE3E5] text-[#121212] hover:bg-[#FEE3E5]/90 text-sm font-normal leading-normal md:w-auto md:flex-shrink-0" /* Removed w-full/lg:w-full, changed justify-end to justify-start */
                      onClick={() => setShowWaitlistModal(true)}
                    >
                      Join the waitlist
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full md:mt-auto"> {/* Bottom Content Container - Added w-full */}
              <hr className="mb-8 border-gray-600" />
              
              <div className="w-full flex flex-col items-start gap-4">
                {/* Changed Button to a simple Link with text styling */}
                <Link 
                  href="/auth/sign-in" 
                  className="text-base font-extrabold text-[#FEE3E5] leading-6 hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div> {/* End of New Inner Wrapper */}

        {/* Right Column (2/3 width) - Now contains the background video and a frame for Vimeo */}
        <div className="relative hidden md:w-2/3 h-full md:flex justify-center items-center p-8"> {/* Corrected to md:flex */}
          {/* Background video (remains as is) */}
          <video
            autoPlay
            loop
            muted
            playsInline
            className="absolute left-0 top-0 h-full w-full object-cover -z-10"
            src="/videos/B-Take3-202505241532.webm"
          >
            Your browser does not support the video tag.
          </video>

          {/* New container for the Vimeo video frame */}
          <div className="relative w-11/12 max-w-3xl bg-zinc-900 rounded-xl shadow-2xl overflow-hidden">
            {/* Vimeo video embed */}
            <div className="aspect-video w-full"> 
              <iframe
                src="https://player.vimeo.com/video/1087453725?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479&amp;transparent=0"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }}
                title="demo-video"
                allowFullScreen
              ></iframe>
            </div>
          </div>

        </div>

        {showWaitlistModal && (
          <WaitlistModal isOpen={showWaitlistModal} onClose={() => setShowWaitlistModal(false)} />
        )}
      </div>
      <Script src="https://player.vimeo.com/api/player.js" strategy="afterInteractive" />
    </>
  );
}
