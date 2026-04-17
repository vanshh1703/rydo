import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Car, Shield, Clock, MapPin, ArrowRight } from 'lucide-react';

const Landing = () => {
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden bg-black text-white">
        <div className="absolute inset-0 z-0 opacity-40">
          <img
            src="https://images.unsplash.com/photo-1449965072333-66e9a6207014?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80"
            alt="City ride"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold mb-6 tracking-tight leading-tight">
            Go anywhere with <span className="text-yellow-400">Rydo</span>
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl mb-10 text-gray-300 max-w-2xl mx-auto leading-relaxed">
            The reliably efficient way to get around. Request a ride, hop in, and go.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {user ? (
              <Link 
                to={user.role === 'driver' ? "/driver" : "/book"} 
                className="w-full sm:w-auto bg-yellow-400 text-black px-10 py-4 rounded-full font-bold text-lg hover:bg-yellow-300 transition-all shadow-xl hover:scale-105 active:scale-95 flex items-center justify-center space-x-2"
              >
                <span>{user.role === 'driver' ? "Go to Dashboard" : "Book a Ride"}</span>
                <ArrowRight size={20} />
              </Link>
            ) : (
              <>
                <Link to="/signup" className="w-full sm:w-auto bg-yellow-400 text-black px-10 py-4 rounded-full font-bold text-lg hover:bg-yellow-300 transition-all shadow-xl hover:scale-105 active:scale-95">
                  Get Started
                </Link>
                <Link to="/login" className="w-full sm:w-auto bg-white/10 backdrop-blur-md text-white border border-white/20 px-10 py-4 rounded-full font-bold text-lg hover:bg-white/20 transition-all">
                  Log In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Why ride with us?</h2>
            <div className="w-16 md:w-20 h-1.5 bg-black mx-auto"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-12">
            {[
              { icon: <Clock className="w-8 h-8" />, title: "On-demand", desc: "Request a ride at any time of the day, any day of the year." },
              { icon: <Shield className="w-8 h-8" />, title: "Safety first", desc: "Our commitment to your safety means vetted drivers and live tracking." },
              { icon: <MapPin className="w-8 h-8" />, title: "Everywhere", desc: "Widespread coverage ensuring a ride is always just a tap away." }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-6 md:p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all border border-gray-100 group">
                <div className="bg-black text-white w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-yellow-400 group-hover:text-black transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed text-sm md:text-base">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* App Promo */}
      <section className="py-16 md:py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          <div className="flex-1 text-center lg:text-left">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6 md:mb-8 leading-tight">Driven by technology, <br className="hidden md:block" />focused on people.</h2>
            <p className="text-base md:text-lg text-gray-600 mb-8 leading-relaxed">
              Our advanced matching algorithm ensures you're paired with the nearest driver instantly, reducing wait times and making your journey smoother.
            </p>
            <div className="flex gap-4 max-w-sm mx-auto lg:mx-0">
              <div className="flex-1 p-4 bg-gray-50 rounded-2xl">
                <div className="font-bold text-2xl md:text-3xl text-black">500k+</div>
                <div className="text-xs md:text-sm text-gray-500">Happy Users</div>
              </div>
              <div className="flex-1 p-4 bg-gray-50 rounded-2xl">
                <div className="font-bold text-2xl md:text-3xl text-black">10k+</div>
                <div className="text-xs md:text-sm text-gray-500">Pro Drivers</div>
              </div>
            </div>
          </div>
          <div className="flex-1 relative w-full max-w-xl mx-auto lg:max-w-none">
            <div className="bg-yellow-100 absolute inset-0 rounded-full scale-90 blur-3xl opacity-50"></div>
            <img
              src="https://images.unsplash.com/photo-1510605395823-530474d7490f?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80"
              alt="Uber like app"
              className="relative z-10 w-full rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border-4 md:border-8 border-gray-900"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-8">
            <div className="bg-white p-1 rounded-md">
              <Car className="text-black w-5 h-5" />
            </div>
            <span className="text-xl font-bold">Rydo</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8 text-gray-400 text-sm md:text-base">
            <a href="#" className="hover:text-white transition-colors">About</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-gray-600 text-xs md:text-sm">
            © 2026 Rydo Technologies Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
