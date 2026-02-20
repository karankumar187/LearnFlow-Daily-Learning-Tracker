const axios = require('axios');
const { validationResult } = require('express-validator');
const AISuggestion = require('../models/AISuggestion');
const Schedule = require('../models/Schedule');
const LearningObjective = require('../models/LearningObjective');
const { HUGGINGFACE_API_KEY } = require('../config/config');

// Hugging Face API configuration
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2';

// @desc    Get AI schedule suggestion
// @route   POST /api/ai/suggest-schedule
// @access  Private
exports.suggestSchedule = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { prompt, studyHoursPerDay, preferredTime } = req.body;

    // Get user's existing objectives for context
    const existingObjectives = await LearningObjective.find({
      user: req.user.id,
      isActive: true
    }).select('title category priority estimatedTime');

    // Build the AI prompt
    const systemPrompt = `<s>[INST] You are an expert learning coach and schedule planner. Your task is to create a personalized weekly learning schedule based on the user's goals and preferences.

User's Request: "${prompt}"

Study Hours Per Day: ${studyHoursPerDay || 4} hours
Preferred Study Time: ${preferredTime || 'morning'}

${existingObjectives.length > 0 ? `Existing Learning Objectives:\n${existingObjectives.map(obj => `- ${obj.title} (${obj.category}, ${obj.estimatedTime}min)`).join('\n')}` : ''}

Please create a detailed weekly schedule (Monday to Sunday).
CRITICAL: If the user requests multiple subjects (e.g. "dbms, dsa, sd"), you MUST mix these subjects every day. Create 2-4 distinct items per day covering different requested subjects.

Format your response as a valid JSON object with this exact structure:

{
  "schedule": [
    {
      "day": "monday",
      "items": [
        {
          "objectiveTitle": "Learn Python Basics",
          "description": "Variables, data types, and basic operations",
          "category": "Python"
        },
        {
          "objectiveTitle": "Database Normalization",
          "description": "Understanding 1NF, 2NF, 3NF",
          "category": "DBMS"
        }
      ]
    }
  ],
  "summary": "Brief summary of the learning plan"
}

Important: 
- Provide ONLY the JSON response, no additional text before or after
- Ensure all 7 days are covered (monday through sunday)
- Each item must have objectiveTitle, description, and category
- Do not include markdown formatting, just raw JSON [/INST]`;

    let aiResponse = null;
    let suggestedSchedule = null;

    // Try Hugging Face API if key is available
    if (HUGGINGFACE_API_KEY) {
      try {
        const response = await axios.post(
          HUGGINGFACE_API_URL,
          {
            inputs: systemPrompt,
            parameters: {
              max_new_tokens: 2000,
              return_full_text: false,
              temperature: 0.7
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        if (response.data && Array.isArray(response.data) && response.data[0] && response.data[0].generated_text) {
          aiResponse = response.data[0].generated_text;
          console.log('AI Response:', aiResponse);
        }
      } catch (apiError) {
        console.log('Hugging Face API error, using fallback:', apiError.message);
      }
    }

    // Parse AI response or use fallback
    if (aiResponse) {
      suggestedSchedule = parseAIResponse(aiResponse, prompt);
    }

    // If parsing failed or no API key, use intelligent fallback
    if (!suggestedSchedule || !suggestedSchedule.schedule || suggestedSchedule.schedule.length === 0) {
      console.log('Using fallback schedule generator');
      suggestedSchedule = generateIntelligentSchedule(prompt, studyHoursPerDay, preferredTime, existingObjectives);
    }

    // Validate and format the schedule
    const formattedSchedule = formatScheduleForStorage(suggestedSchedule.schedule);

    // Save the suggestion
    const suggestion = await AISuggestion.create({
      user: req.user.id,
      prompt,
      suggestedSchedule: formattedSchedule,
      summary: suggestedSchedule.summary || 'AI-generated learning schedule'
    });

    res.status(200).json({
      success: true,
      data: {
        suggestionId: suggestion._id,
        prompt,
        schedule: suggestedSchedule.schedule,
        summary: suggestedSchedule.summary,
        isAIGenerated: !!aiResponse
      }
    });
  } catch (error) {
    console.error('AI Suggestion Error:', error);
    next(error);
  }
};

// @desc    Apply AI suggestion to create schedule
// @route   POST /api/ai/apply-suggestion/:suggestionId
// @access  Private
exports.applySuggestion = async (req, res, next) => {
  try {
    const { suggestionId } = req.params;
    const { name, description } = req.body;

    const suggestion = await AISuggestion.findOne({
      _id: suggestionId,
      user: req.user.id
    });

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    if (suggestion.isApplied) {
      return res.status(400).json({
        success: false,
        message: 'Suggestion has already been applied'
      });
    }

    // Create learning objectives from suggestion if they don't exist
    const weeklySchedule = [];
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    for (const day of days) {
      const dayItems = suggestion.suggestedSchedule.filter(item => item.day === day);
      const items = [];

      for (const item of dayItems) {
        // Check if objective exists
        let objective = await LearningObjective.findOne({
          user: req.user.id,
          title: { $regex: new RegExp(`^${item.objectiveTitle}$`, 'i') },
          isActive: true
        });

        // Create if doesn't exist
        if (!objective) {
          objective = await LearningObjective.create({
            user: req.user.id,
            title: item.objectiveTitle,
            description: item.description || '',
            category: item.category || 'General',
            estimatedTime: item.duration || 60,
            priority: 'medium'
          });
        }

        items.push({
          learningObjective: objective._id,
          startTime: item.startTime || null,
          endTime: item.endTime || null,
          duration: item.duration || 60
        });
      }

      weeklySchedule.push({
        day,
        items,
        isActive: true
      });
    }

    // Unset other default schedules
    await Schedule.updateMany(
      { user: req.user.id },
      { isDefault: false }
    );

    // Create the new schedule
    const schedule = await Schedule.create({
      user: req.user.id,
      name: name || `AI Schedule - ${new Date().toLocaleDateString()}`,
      description: description || `Generated from AI suggestion: ${suggestion.prompt.substring(0, 100)}...`,
      weeklySchedule,
      isDefault: true
    });

    // Mark suggestion as applied
    suggestion.isApplied = true;
    suggestion.appliedAt = new Date();
    await suggestion.save();

    res.status(201).json({
      success: true,
      message: 'Schedule created successfully',
      data: schedule
    });
  } catch (error) {
    console.error('Apply Suggestion Error:', error);
    next(error);
  }
};

// @desc    Get AI suggestion history
// @route   GET /api/ai/suggestions
// @access  Private
exports.getSuggestions = async (req, res, next) => {
  try {
    const suggestions = await AISuggestion.find({
      user: req.user.id
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single suggestion
// @route   GET /api/ai/suggestions/:id
// @access  Private
exports.getSuggestion = async (req, res, next) => {
  try {
    const suggestion = await AISuggestion.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    res.status(200).json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Modify suggestion before applying
// @route   PUT /api/ai/suggestions/:id
// @access  Private
exports.updateSuggestion = async (req, res, next) => {
  try {
    const { suggestedSchedule } = req.body;

    let suggestion = await AISuggestion.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    if (suggestion.isApplied) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify applied suggestion'
      });
    }

    suggestion.suggestedSchedule = suggestedSchedule;
    await suggestion.save();

    res.status(200).json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete suggestion
// @route   DELETE /api/ai/suggestions/:id
// @access  Private
exports.deleteSuggestion = async (req, res, next) => {
  try {
    const suggestion = await AISuggestion.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!suggestion) {
      return res.status(404).json({
        success: false,
        message: 'Suggestion not found'
      });
    }

    await AISuggestion.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Suggestion deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to format schedule for storage
function formatScheduleForStorage(schedule) {
  if (!Array.isArray(schedule)) return [];

  const formatted = [];
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (const daySchedule of schedule) {
    if (!daySchedule || !daySchedule.day) continue;

    const day = daySchedule.day.toLowerCase();
    if (!days.includes(day)) continue;

    const items = daySchedule.items || [];

    for (const item of items) {
      if (!item || !item.objectiveTitle) continue;

      formatted.push({
        objectiveTitle: item.objectiveTitle,
        description: item.description || '',
        day: day,
        startTime: item.startTime || null,
        endTime: item.endTime || null,
        duration: item.duration || 60,
        category: item.category || 'General'
      });
    }
  }

  return formatted;
}

// Helper function to generate intelligent schedule when AI API is unavailable
function generateIntelligentSchedule(prompt, studyHoursPerDay = 4, preferredTime = 'morning', existingObjectives) {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const schedule = [];

  // Parse prompt for keywords
  const promptLower = prompt.toLowerCase();
  let subjects = [];

  // Common learning subjects including acronyms
  const subjectKeywords = {
    'programming': ['programming', 'coding', 'python', 'javascript', 'java', 'cpp', 'developer'],
    'web development': ['web', 'frontend', 'backend', 'fullstack', 'react', 'node'],
    'data science': ['data science', 'machine learning', 'ai', 'ml', 'data analysis', 'statistics'],
    'design': ['design', 'ui', 'ux', 'graphic', 'figma', 'photoshop'],
    'language': ['language', 'english', 'spanish', 'french', 'german', 'learning'],
    'math': ['math', 'mathematics', 'calculus', 'algebra', 'statistics'],
    'business': ['business', 'marketing', 'finance', 'entrepreneurship', 'management'],
    'system design': ['system design', 'sd', 'architecture', 'scalability'],
    'database': ['database', 'dbms', 'sql', 'nosql', 'mongodb', 'postgresql'],
    'algorithms': ['algorithms', 'data structures', 'dsa', 'leetcode'],
    'operating systems': ['operating systems', 'os', 'linux']
  };

  for (const [subject, keywords] of Object.entries(subjectKeywords)) {
    // Check if any keyword stands alone or exists in prompt
    if (keywords.some(kw => promptLower.includes(kw) || new RegExp(`\\b${kw}\\b`).test(promptLower))) {
      subjects.push(subject);
    }
  }

  // If no predefined subjects found, dynamically extract from comma lists
  if (subjects.length === 0) {
    if (promptLower.includes(',')) {
      subjects = promptLower.split(',').map(s => s.trim()).filter(s => s.length > 0 && s.length < 25);
    } else {
      // Split by spaces and grab a few prominent words
      const words = promptLower.split(' ').filter(w => w.length > 3 && !['want', 'learn', 'study', 'about', 'how', 'the', 'and', 'for'].includes(w));
      subjects = words.slice(0, 3);
    }

    if (subjects.length === 0) {
      subjects.push('general learning');
    }
  }

  // Generate schedule for each day
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const items = [];

    // Weekend has lighter schedule, weekdays have more items
    const isWeekend = day === 'saturday' || day === 'sunday';
    const numItems = isWeekend ? Math.max(1, Math.ceil(subjects.length / 2)) : Math.min(subjects.length, 3);

    for (let j = 0; j < numItems; j++) {
      // Rotate through subjects so each day gets a mix
      const subjectIndex = (i + j) % subjects.length;
      const subject = subjects[subjectIndex];

      const learningTopics = {
        'programming': ['Variables and Data Types', 'Control Structures', 'Functions', 'OOP Concepts', 'Data Structures'],
        'web development': ['HTML & CSS Basics', 'JavaScript Fundamentals', 'React Components', 'API Integration', 'Database Design'],
        'data science': ['Data Cleaning', 'Exploratory Analysis', 'Visualization', 'Model Building', 'Evaluation'],
        'design': ['Design Principles', 'Color Theory', 'Typography', 'UI Patterns', 'Prototyping'],
        'language': ['Vocabulary', 'Grammar', 'Speaking Practice', 'Listening', 'Writing'],
        'math': ['Algebra', 'Calculus', 'Statistics', 'Linear Algebra', 'Problem Solving'],
        'business': ['Market Research', 'Business Strategy', 'Financial Planning', 'Marketing', 'Operations'],
        'system design': ['Load Balancing', 'Microservices', 'Caching', 'Database Partitioning', 'Message Queues'],
        'database': ['Entity-Relationship Models', 'Normalization', 'SQL Queries', 'Indexing', 'Transactions'],
        'algorithms': ['Arrays & Strings', 'Linked Lists', 'Trees & Graphs', 'Dynamic Programming', 'Sorting & Searching'],
        'operating systems': ['Processes & Threads', 'Memory Management', 'File Systems', 'Concurrency', 'Deadlocks'],
        'general learning': ['Core Concepts', 'Practice Problems', 'Review', 'Advanced Topics', 'Project Work']
      };

      const topics = learningTopics[subject] || learningTopics['general learning'];
      const topic = topics[(i + j) % topics.length];

      const formattedSubject = subject.toUpperCase() === subject || subject.length <= 3
        ? subject.toUpperCase()
        : subject.charAt(0).toUpperCase() + subject.slice(1);

      items.push({
        objectiveTitle: `${formattedSubject}: ${topic}`,
        description: `Focus on ${topic.toLowerCase()} with practical exercises`,
        startTime: null,
        endTime: null,
        duration: Math.floor((studyHoursPerDay * 60) / numItems),
        category: formattedSubject
      });
    }

    schedule.push({
      day,
      items
    });
  }

  const uniqueSubjects = [...new Set(subjects)].map(s => s.toUpperCase() === s || s.length <= 3 ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1));
  const subjectsLabel = uniqueSubjects.join(', ');

  return {
    schedule,
    summary: `Here's a ${studyHoursPerDay}-hour-per-day weekly plan focused on ${subjectsLabel}. It balances new concepts, practice, and review across the week so you can make steady progress without burning out.`
  };
}

// Helper function to parse AI response
function parseAIResponse(aiResponse, originalPrompt) {
  try {
    // Remove markdown code blocks if present
    let cleanedResponse = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Try to find JSON object
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (parsed.schedule && Array.isArray(parsed.schedule)) {
        return {
          schedule: parsed.schedule,
          summary: parsed.summary || 'AI-generated learning schedule'
        };
      }
    }

    // Try alternative parsing - look for array directly
    const arrayMatch = cleanedResponse.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        return {
          schedule: parsed,
          summary: 'AI-generated learning schedule'
        };
      }
    }
  } catch (e) {
    console.log('Failed to parse AI response as JSON:', e.message);
  }

  return null;
}

// @desc    General AI chat (conversational)
// @route   POST /api/ai/chat
// @access  Private
exports.chatWithAI = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { prompt } = req.body;

    let reply = null;

    if (HUGGINGFACE_API_KEY) {
      try {
        const systemPrompt = `<s>[INST] You are a friendly, encouraging learning coach and tutor for the LearnFlow app.
Help the user with their learning goals. Be concise, concrete, and actionable. Do NOT return JSON, only natural language.

User: "${prompt}" [/INST]`;

        const response = await axios.post(
          HUGGINGFACE_API_URL,
          {
            inputs: systemPrompt,
            parameters: {
              max_new_tokens: 250,
              return_full_text: false,
              temperature: 0.7
            }
          },
          {
            headers: {
              'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        if (response.data && Array.isArray(response.data) && response.data[0] && response.data[0].generated_text) {
          let raw = response.data[0].generated_text.trim();
          // Fallback cleanup if return_full_text: false is ignored by the specific model endpoint
          if (raw.includes('[/INST]')) {
            raw = raw.split('[/INST]')[1].trim();
          }
          reply = raw;
        }
      } catch (apiError) {
        console.log('Hugging Face chat API error, using fallback:', apiError.message);
      }
    }

    if (!reply) {
      reply = `Here's a quick suggestion based on what you asked: ${prompt}\n\nBreak this into small sessions, focus on one clear objective at a time, and always finish by writing down what you learned or what you'll do next.`;
    }

    res.status(200).json({
      success: true,
      data: { reply }
    });
  } catch (error) {
    next(error);
  }
};
