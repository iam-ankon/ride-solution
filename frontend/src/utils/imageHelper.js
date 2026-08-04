const API_URL = import.meta.env.VITE_API_URL || 'https://ride-solution-backend-udox.onrender.com';

export const getImageUrl = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // If it's a local path, prepend the API URL
  if (imagePath.startsWith('/media/')) {
    return `${API_URL}${imagePath}`;
  }
  
  return imagePath;
};

export const getCarImage = (car) => {
  if (car.images && car.images.length > 0 && car.images[0].image) {
    return getImageUrl(car.images[0].image);
  }
  return 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400';
};