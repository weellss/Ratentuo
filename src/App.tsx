import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { PostRequestPage } from './pages/PostRequestPage';
import { LiveAuctionsPage } from './pages/LiveAuctionsPage';
import { AuctionDetailPage } from './pages/AuctionDetailPage';
import { MyActivityPage } from './pages/MyActivityPage';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/post" element={<PostRequestPage />} />
          <Route path="/auctions" element={<LiveAuctionsPage />} />
          <Route path="/auctions/:id" element={<AuctionDetailPage />} />
          <Route path="/activity" element={<MyActivityPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
