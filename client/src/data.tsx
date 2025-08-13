const EventDetailExample = {
  event: {
    id: 123,
    title: "Выбор даты для встречи команды",
    description: "Давайте выберем удобное время для следующей командной встречи",
    timezone: "Europe/Moscow",
    event_type: "poll",
    multiple_choice: true,
    created_at: "2023-11-15T10:00:00Z",
    updated_at: "2023-11-16T09:30:00Z",
    deleted_at: null,
    user_id: 456,
    final_slot_id: 789,
    is_creator: true,
    creator: {
      user_id: 456,
      username: "team_lead",
      first_name: "Иван",
      photo_url: "https://example.com/photos/ivan.jpg"
    }
  },
  slots: [
    {
      id: 789,
      slot_start: "2023-11-20T10:00:00Z",
      booked_by: null,
      booked_at: null,
      created_at: "2023-11-15T10:05:00Z",
      current_user_voted: true,
      vote_count: 3,
      voters: [
        {
          user_id: 456,
          username: "team_lead",
          first_name: "Иван",
          photo_url: "https://example.com/photos/ivan.jpg",
          voted_at: "2023-11-15T11:20:00Z"
        },
        {
          user_id: 789,
          username: "dev_alex",
          first_name: "Алексей",
          photo_url: "https://example.com/photos/alex.jpg",
          voted_at: "2023-11-15T14:30:00Z"
        },
        {
          user_id: 1011,
          username: null,
          first_name: "Мария",
          photo_url: "https://example.com/photos/maria.jpg",
          voted_at: "2023-11-16T09:15:00Z"
        }
      ]
    },
    {
      id: 790,
      slot_start: "2023-11-20T14:00:00Z",
      booked_by: null,
      booked_at: null,
      created_at: "2023-11-15T10:05:00Z",
      current_user_voted: false,
      vote_count: 2,
      voters: [
        {
          user_id: 789,
          username: "dev_alex",
          first_name: "Алексей",
          photo_url: "https://example.com/photos/alex.jpg",
          voted_at: "2023-11-15T14:35:00Z"
        },
        {
          user_id: 1011,
          username: null,
          first_name: "Мария",
          photo_url: "https://example.com/photos/maria.jpg",
          voted_at: "2023-11-16T09:20:00Z"
        }
      ]
    }
  ],
  participants: [
    {
      user_id: 456,
      username: "team_lead",
      first_name: "Иван",
      photo_url: "https://example.com/photos/ivan.jpg"
    },
    {
      user_id: 789,
      username: "dev_alex",
      first_name: "Алексей",
      photo_url: "https://example.com/photos/alex.jpg"
    },
    {
      user_id: 1011,
      username: null,
      first_name: "Мария",
      photo_url: "https://example.com/photos/maria.jpg"
    }
  ],
  current_user_votes: [
    {
      slot_id: 789,
      created_at: "2023-11-15T11:20:00Z"
    }
  ]
};