"use client"
import { useRouter } from "next/router"

const AdCard = ({ ad }) => {
  const router = useRouter()

  const handleViewDetails = () => {
    router.push(`/test-view-details`)
  }

  return (
    <div>
      <h2>{ad.title}</h2>
      <p>{ad.description}</p>
      <button onClick={handleViewDetails}>View Details</button>
    </div>
  )
}

export default AdCard
