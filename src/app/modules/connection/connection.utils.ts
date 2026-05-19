export const generateConnectionKey = (userA: string, userB: string): string => {
  const user1 = userA < userB ? userA : userB;
  const user2 = userA < userB ? userB : userA;

  return `${user1}_${user2}`;
};
