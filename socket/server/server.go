package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WebSocketServer struct {
	clients map[string]*websocket.Conn
	lock    sync.RWMutex
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func NewWebSocketServer() *WebSocketServer {
	return &WebSocketServer{
		clients: make(map[string]*websocket.Conn),
	}
}

func (s *WebSocketServer) HandleConnections(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "Could not upgrade connection", http.StatusBadRequest)
		return
	}
	defer conn.Close()

	clientID := r.URL.Query().Get("id")
	if clientID == "" {
		sendErrorToConnection(conn, "Client ID required")
		return
	}

	s.lock.Lock()
	s.clients[clientID] = conn
	s.lock.Unlock()
	fmt.Printf("Client %s connected\n", clientID)

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			break
		}

		message, err := ParseData(msg)
		if !s.clientExists(message.To) {
			sendErrorToConnection(conn, fmt.Sprintf("Target client %s does not exist", message.To))
			continue
		}

		if message.To == message.From {
			sendErrorToConnection(conn, "Sender and recipient cannot be the same")
			continue
		}

		if message.To == "all" {
			for clientID := range s.clients {
				if clientID == message.From {
					continue
				}
				s.SendMessageToClient(clientID, msg)
			}
			continue
		}

		if err != nil {
			sendErrorToConnection(conn, fmt.Sprintf("Invalid message format: %v", err))
			continue
		}

		// Validate message fields
		if err := s.validateMessage(message); err != nil {
			sendErrorToConnection(conn, err.Error())
			continue
		}

		// Check if target client exists

		s.SendMessageToClient(message.To, msg)
	}

	s.lock.Lock()
	delete(s.clients, clientID)
	s.lock.Unlock()
	fmt.Printf("Client %s disconnected\n", clientID)
}

func (s *WebSocketServer) clientExists(clientID string) bool {
	s.lock.RLock()
	defer s.lock.RUnlock()
	_, exists := s.clients[clientID]
	return exists
}

func sendErrorToConnection(conn *websocket.Conn, errorMsg string) {
	errorResponse := ErrorResponse{Error: errorMsg}
	errorBytes, _ := json.Marshal(errorResponse)
	conn.WriteMessage(websocket.TextMessage, errorBytes)
}

func (s *WebSocketServer) SendMessageToClient(clientID string, msg []byte) error {
	s.lock.RLock()
	defer s.lock.RUnlock()

	conn, exists := s.clients[clientID]
	if !exists {
		return fmt.Errorf("client %s not found", clientID)
	}

	return conn.WriteMessage(websocket.TextMessage, msg)
}

func (s *WebSocketServer) validateMessage(m *Message) error {
	if m.From == "" {
		return fmt.Errorf("from field is required")
	}
	if m.To == "" {
		return fmt.Errorf("to field is required")
	}
	if m.Xval == 0 && m.Yval == 0 {
		return fmt.Errorf("invalid coordinate values")
	}
	if m.Gestval == "" {
		return fmt.Errorf("gesture value is required")
	}

	return nil
}
