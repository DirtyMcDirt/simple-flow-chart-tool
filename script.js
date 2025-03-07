/**
 * Simple Flow Chart Tool
 * A lightweight tool for creating user flow diagrams
 */

// Main application class
class FlowChartApp {
    constructor() {
        // State variables
        this.nodes = [];
        this.connections = [];
        this.nextNodeId = 1;
        this.nextConnectionId = 1;
        this.selectedElement = null;
        this.isDragging = false;
        this.isEditing = false; // Flag to track if we're currently editing text
        this.lastNodePosition = { x: 100, y: 100 }; // Track last node position to prevent stacking
        this.gridSize = 20; // Grid size for snap functionality
        this.scale = 1;
        
        // Connection drag state
        this.isCreatingConnection = false;
        this.connectionSource = null;
        this.connectionSourcePosition = null;
        this.tempConnection = null;
        
        // DOM elements
        this.canvas = document.getElementById('canvas');
        this.propertiesPanel = document.getElementById('properties-panel');
        this.propertiesContent = document.getElementById('properties-content');
        this.nodeContextMenu = document.getElementById('node-context-menu');
        this.connectionContextMenu = document.getElementById('connection-context-menu');
        
        // Setup
        this.setupCanvas();
        this.setupEventListeners();
        this.createSVGDefinitions();
    }
    
    // Initialize canvas with SVG elements
    setupCanvas() {
        // Create SVG container for connections
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', '100%');
        this.svg.setAttribute('height', '100%');
        this.svg.style.position = 'absolute';
        this.svg.style.top = '0';
        this.svg.style.left = '0';
        this.svg.style.pointerEvents = 'none';
        this.svg.style.zIndex = '1'; // Ensure SVG is above nodes
        this.canvas.appendChild(this.svg);
    }
    
    // Create SVG definitions (like arrowheads)
    createSVGDefinitions() {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        
        // Create arrowhead marker
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', '#333');
        
        marker.appendChild(polygon);
        defs.appendChild(marker);
        this.svg.appendChild(defs);
    }
    
    // Setup all event listeners
    setupEventListeners() {
        // Toolbar buttons
        document.getElementById('add-node').addEventListener('click', () => this.addNode());
        document.getElementById('delete-selected').addEventListener('click', () => this.deleteSelected());
        document.getElementById('clear-all').addEventListener('click', () => this.clearAll());
        document.getElementById('export-png').addEventListener('click', () => this.exportAsPNG());
        document.getElementById('export-json').addEventListener('click', () => this.exportAsJSON());
        document.getElementById('import-json').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => this.importFromJSON(e));
        
        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-reset').addEventListener('click', () => this.resetZoom());
        
        // Context menu interactions
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenus();
            }
        });
        this.nodeContextMenu.addEventListener('click', (e) => this.handleNodeContextMenu(e));
        this.connectionContextMenu.addEventListener('click', (e) => this.handleConnectionContextMenu(e));
        
        // Canvas interactions
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        document.addEventListener('mouseup', (e) => {
            // When mouse is released outside the canvas, stop any dragging
            if (!e.target.closest('#canvas')) {
                this.isDragging = false;
                this.endConnectionDrag();
            }
        });
        
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });

        // Add double-click listener for editing node text directly inline
        this.canvas.addEventListener('dblclick', (e) => {
            if (this.isEditing) return; // Prevent nested editing
            
            const nodeContent = e.target.closest('.node-content');
            if (nodeContent) {
                const nodeElement = nodeContent.closest('.flow-node');
                if (nodeElement) {
                    this.makeNodeContentEditable(nodeElement, nodeContent);
                }
            }
        });
        
        // Global click handler to handle clicks outside the editing area
        document.addEventListener('click', (e) => {
            if (this.isEditing && !e.target.classList.contains('node-content-editable')) {
                this.finishEditing();
            }
        });
        
        // Handle keyboard events for the entire document
        document.addEventListener('keydown', (e) => {
            if (this.isEditing && e.key === 'Enter') {
                e.preventDefault();
                this.finishEditing();
            }
            
            if (this.isEditing && e.key === 'Escape') {
                e.preventDefault();
                this.cancelEditing();
            }
            
            // Delete key for selected elements
            if (!this.isEditing && this.selectedElement && e.key === 'Delete') {
                this.deleteSelected();
            }
        });
    }
    
    // Make node content editable inline
    makeNodeContentEditable(nodeElement, nodeContent) {
        // Store original text for cancellation
        const originalText = nodeContent.textContent;
        nodeContent.dataset.originalText = originalText;
        
        // Make content editable
        nodeContent.contentEditable = true;
        nodeContent.classList.add('node-content-editable');
        
        // Setup selection and focus
        this.isEditing = true;
        this.editingNodeId = nodeElement.dataset.id;
        
        // Focus and select all text
        nodeContent.focus();
        
        // Create a range to select all the text
        const range = document.createRange();
        range.selectNodeContents(nodeContent);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Prevent node dragging while editing
        nodeElement.style.pointerEvents = 'none';
        nodeContent.style.pointerEvents = 'auto';
    }
    
    // Finish editing node content
    finishEditing() {
        if (!this.isEditing) return;
        
        const editableContent = document.querySelector('.node-content-editable');
        if (!editableContent) return;
        
        const newText = editableContent.textContent.trim();
        const nodeElement = editableContent.closest('.flow-node');
        
        if (nodeElement) {
            const nodeId = nodeElement.dataset.id;
            const nodeData = this.nodes.find(n => n.id === nodeId);
            
            if (nodeData && newText) {
                nodeData.text = newText;
                
                // Restore styles and attributes
                editableContent.contentEditable = false;
                editableContent.classList.remove('node-content-editable');
                nodeElement.style.pointerEvents = 'auto';
                
                // Update properties panel if this node is selected
                if (this.selectedElement === nodeElement) {
                    const textInput = document.getElementById('prop-node-text');
                    if (textInput) {
                        textInput.value = newText;
                    }
                }
            }
        }
        
        this.isEditing = false;
        this.editingNodeId = null;
    }
    
    // Cancel editing and restore original text
    cancelEditing() {
        if (!this.isEditing) return;
        
        const editableContent = document.querySelector('.node-content-editable');
        if (!editableContent) return;
        
        // Restore original text
        const originalText = editableContent.dataset.originalText || '';
        editableContent.textContent = originalText;
        
        // Restore styles and attributes
        editableContent.contentEditable = false;
        editableContent.classList.remove('node-content-editable');
        const nodeElement = editableContent.closest('.flow-node');
        if (nodeElement) {
            nodeElement.style.pointerEvents = 'auto';
        }
        
        this.isEditing = false;
        this.editingNodeId = null;
    }
    
    // Add a new node to the canvas
    addNode(x, y, type, text) {
        const nodeType = type || document.getElementById('node-type').value;
        const nodeText = text || 'New Node';
        
        // If x and y are not provided, use the last position plus an offset
        if (x === undefined || y === undefined) {
            // Calculate position based on last node to prevent stacking
            x = this.lastNodePosition.x + 160; // Horizontal spacing
            y = this.lastNodePosition.y;
            
            // If we've moved too far right, start a new row
            const maxX = 2000; // Maximum x position before wrapping
            if (x > maxX) {
                x = 100; // Reset to left side
                y += 120; // Move down for a new row
            }
            
            // Update last position for next node
            this.lastNodePosition = { x, y };
        }
        
        const node = document.createElement('div');
        node.className = `flow-node node-${nodeType}`;
        node.dataset.id = this.nextNodeId++;
        node.dataset.type = nodeType;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        
        const nodeContent = document.createElement('div');
        nodeContent.className = 'node-content';
        nodeContent.textContent = nodeText;
        node.appendChild(nodeContent);
        
        // Add connectors for different sides of the node
        const positions = ['top', 'right', 'bottom', 'left'];
        positions.forEach(pos => {
            const connector = document.createElement('div');
            connector.className = 'connector';
            connector.dataset.position = pos;
            
            // Position connectors
            switch (pos) {
                case 'top':
                    connector.style.top = '0';
                    connector.style.left = '50%';
                    connector.style.transform = 'translate(-50%, -50%)';
                    break;
                case 'right':
                    connector.style.top = '50%';
                    connector.style.right = '0';
                    connector.style.transform = 'translate(50%, -50%)';
                    break;
                case 'bottom':
                    connector.style.bottom = '0';
                    connector.style.left = '50%';
                    connector.style.transform = 'translate(-50%, 50%)';
                    break;
                case 'left':
                    connector.style.top = '50%';
                    connector.style.left = '0';
                    connector.style.transform = 'translate(-50%, -50%)';
                    break;
            }
            
            // Add connector event listeners for drag-and-drop connection creation
            connector.addEventListener('mousedown', (e) => {
                e.stopPropagation(); // Prevent node dragging when clicking connector
                this.startConnectionDrag(node.dataset.id, pos, e);
            });
            
            node.appendChild(connector);
        });
        
        // Store node data
        this.nodes.push({
            id: node.dataset.id,
            type: nodeType,
            text: nodeText,
            x: x,
            y: y
        });
        
        this.canvas.appendChild(node);

        // Select the newly created node
        this.deselectAll();
        node.classList.add('selected');
        this.selectedElement = node;
        this.updatePropertiesPanel();
        
        return node;
    }
    
    // Start creating a connection by dragging from a connector
    startConnectionDrag(nodeId, position, event) {
        if (this.isEditing) return; // Don't create connections while editing text
        
        this.isCreatingConnection = true;
        this.connectionSource = nodeId;
        this.connectionSourcePosition = position;
        
        // Create a temporary visual connection line
        this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.tempConnection.setAttribute('class', 'connection-line temp-connection');
        this.tempConnection.style.strokeDasharray = '5,5';
        this.tempConnection.style.pointerEvents = 'none';
        this.svg.appendChild(this.tempConnection);
        
        // Get the starting point coordinates from the connector
        const sourceNode = this.findNodeElement(nodeId);
        const sourceConnector = sourceNode.querySelector(`.connector[data-position="${position}"]`);
        const sourceRect = sourceConnector.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        // Calculate the starting coordinates
        this.connectionStartX = (sourceRect.left + sourceRect.width / 2 - canvasRect.left) / this.scale;
        this.connectionStartY = (sourceRect.top + sourceRect.height / 2 - canvasRect.top) / this.scale;
        
        // Initial line drawn to cursor position
        const mouseX = (event.clientX - canvasRect.left) / this.scale;
        const mouseY = (event.clientY - canvasRect.top) / this.scale;
        
        this.updateTempConnection(mouseX, mouseY);
        
        // Add a class to the canvas to show we're in connection creation mode
        this.canvas.classList.add('creating-connection');
    }
    
    // Update the temporary connection line during dragging
    updateTempConnection(endX, endY) {
        if (!this.isCreatingConnection || !this.tempConnection) return;
        
        // Draw a curved path from start to current mouse position
        const dx = Math.abs(endX - this.connectionStartX);
        const dy = Math.abs(endY - this.connectionStartY);
        const controlOffset = Math.min(100, Math.max(50, Math.min(dx, dy) * 0.5));
        
        let sourceControlX, sourceControlY, targetControlX, targetControlY;
        
        // Adjust control points based on source position
        switch (this.connectionSourcePosition) {
            case 'right':
                sourceControlX = this.connectionStartX + controlOffset;
                sourceControlY = this.connectionStartY;
                break;
            case 'left':
                sourceControlX = this.connectionStartX - controlOffset;
                sourceControlY = this.connectionStartY;
                break;
            case 'bottom':
                sourceControlX = this.connectionStartX;
                sourceControlY = this.connectionStartY + controlOffset;
                break;
            case 'top':
                sourceControlX = this.connectionStartX;
                sourceControlY = this.connectionStartY - controlOffset;
                break;
            default:
                sourceControlX = this.connectionStartX + controlOffset;
                sourceControlY = this.connectionStartY;
        }
        
        // Simple target control point
        targetControlX = endX - (endX - this.connectionStartX) * 0.5;
        targetControlY = endY - (endY - this.connectionStartY) * 0.5;
        
        const pathData = `M ${this.connectionStartX},${this.connectionStartY} 
                         C ${sourceControlX},${sourceControlY} 
                           ${targetControlX},${targetControlY} 
                           ${endX},${endY}`;
        
        this.tempConnection.setAttribute('d', pathData);
        
        // Highlight potential target connectors
        this.highlightPotentialTargets(endX, endY);
    }
    
    // Highlight potential target connectors when hovering near them
    highlightPotentialTargets(x, y) {
        // Remove any existing highlights
        document.querySelectorAll('.connector-highlight').forEach(connector => {
            connector.classList.remove('connector-highlight');
        });
        
        // Find connector near cursor
        const connectors = document.querySelectorAll('.connector');
        const radius = 20; // Distance in pixels to trigger highlight
        
        connectors.forEach(connector => {
            const nodeElement = connector.closest('.flow-node');
            if (nodeElement && nodeElement.dataset.id === this.connectionSource) {
                return; // Skip connectors on the source node
            }
            
            const rect = connector.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            const connectorX = (rect.left + rect.width / 2 - canvasRect.left) / this.scale;
            const connectorY = (rect.top + rect.height / 2 - canvasRect.top) / this.scale;
            
            const distance = Math.sqrt(Math.pow(connectorX - x, 2) + Math.pow(connectorY - y, 2));
            
            if (distance <= radius) {
                connector.classList.add('connector-highlight');
            }
        });
    }
    
    // End connection creation and establish connection if over a valid target
    endConnectionDrag(event) {
        if (!this.isCreatingConnection) return;
        
        // If the mouse is over a connector, create a permanent connection
        const highlightedConnector = document.querySelector('.connector-highlight');
        if (highlightedConnector && event) {
            const targetNode = highlightedConnector.closest('.flow-node');
            if (targetNode && targetNode.dataset.id !== this.connectionSource) {
                const targetId = targetNode.dataset.id;
                const targetPosition = highlightedConnector.dataset.position;
                
                this.createConnection(
                    this.connectionSource, 
                    targetId, 
                    this.connectionSourcePosition, 
                    targetPosition
                );
            }
        }
        
        // Remove temporary visual elements
        if (this.tempConnection) {
            this.tempConnection.remove();
            this.tempConnection = null;
        }
        
        // Remove highlights
        document.querySelectorAll('.connector-highlight').forEach(connector => {
            connector.classList.remove('connector-highlight');
        });
        
        // Reset connection state
        this.isCreatingConnection = false;
        this.connectionSource = null;
        this.connectionSourcePosition = null;
        this.connectionStartX = null;
        this.connectionStartY = null;
        
        // Remove creation mode class
        this.canvas.classList.remove('creating-connection');
    }
    
    // Create a connection between two nodes
    createConnection(sourceId, targetId, sourcePosition, targetPosition, label) {
        if (sourceId === targetId) return;
        
        // Find source and target nodes
        const sourceNode = this.findNodeElement(sourceId);
        const targetNode = this.findNodeElement(targetId);
        
        if (!sourceNode || !targetNode) return;
        
        // Get the exact connector elements
        const sourceConnector = sourceNode.querySelector(`.connector[data-position="${sourcePosition}"]`);
        const targetConnector = targetNode.querySelector(`.connector[data-position="${targetPosition}"]`);
        
        if (!sourceConnector || !targetConnector) return;
        
        // Calculate connection points based on connector positions
        const sourceRect = sourceConnector.getBoundingClientRect();
        const targetRect = targetConnector.getBoundingClientRect();
        const canvasRect = this.canvas.getBoundingClientRect();
        
        const sourceX = (sourceRect.left + sourceRect.width / 2 - canvasRect.left) / this.scale;
        const sourceY = (sourceRect.top + sourceRect.height / 2 - canvasRect.top) / this.scale;
        const targetX = (targetRect.left + targetRect.width / 2 - canvasRect.left) / this.scale;
        const targetY = (targetRect.top + targetRect.height / 2 - canvasRect.top) / this.scale;
        
        // Create the SVG path for the connection
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-line');
        path.dataset.sourceId = sourceId;
        path.dataset.targetId = targetId;
        path.dataset.sourcePosition = sourcePosition;
        path.dataset.targetPosition = targetPosition;
        path.dataset.id = this.nextConnectionId++;
        path.style.pointerEvents = 'stroke'; // Make path clickable
        
        // Calculate curve based on connector positions
        const pathData = this.calculateConnectionPath(
            sourceX, sourceY, targetX, targetY,
            sourcePosition, targetPosition
        );
        
        path.setAttribute('d', pathData);
        
        // Add click event for selecting the path
        path.addEventListener('click', (e) => {
            if (this.isEditing || this.isCreatingConnection) return;
            
            e.stopPropagation();
            this.deselectAll();
            this.selectedElement = path;
            path.classList.add('selected');
            this.updatePropertiesPanel();
        });
        
        this.svg.appendChild(path);
        
        // Add connection label if provided
        const connectionLabel = label || '';
        
        // Store connection data
        this.connections.push({
            id: path.dataset.id,
            sourceId: sourceId,
            targetId: targetId,
            sourcePosition: sourcePosition,
            targetPosition: targetPosition,
            label: connectionLabel
        });
        
        // If a label is provided, add it to the path
        if (connectionLabel) {
            this.addConnectionLabel(path.dataset.id, connectionLabel);
        }
        
        return path;
    }
    
    // Calculate path data for a connection based on connector positions
    calculateConnectionPath(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition) {
        const dx = Math.abs(targetX - sourceX);
        const dy = Math.abs(targetY - sourceY);
        const defaultControlOffset = Math.min(80, Math.max(40, Math.min(dx, dy) * 0.5));
        
        let sourceControlX, sourceControlY, targetControlX, targetControlY;
        
        // Set control points based on connector positions
        switch (sourcePosition) {
            case 'right':
                sourceControlX = sourceX + defaultControlOffset;
                sourceControlY = sourceY;
                break;
            case 'left':
                sourceControlX = sourceX - defaultControlOffset;
                sourceControlY = sourceY;
                break;
            case 'bottom':
                sourceControlX = sourceX;
                sourceControlY = sourceY + defaultControlOffset;
                break;
            case 'top':
                sourceControlX = sourceX;
                sourceControlY = sourceY - defaultControlOffset;
                break;
            default:
                sourceControlX = sourceX + defaultControlOffset;
                sourceControlY = sourceY;
        }
        
        switch (targetPosition) {
            case 'right':
                targetControlX = targetX + defaultControlOffset;
                targetControlY = targetY;
                break;
            case 'left':
                targetControlX = targetX - defaultControlOffset;
                targetControlY = targetY;
                break;
            case 'bottom':
                targetControlX = targetX;
                targetControlY = targetY + defaultControlOffset;
                break;
            case 'top':
                targetControlX = targetX;
                targetControlY = targetY - defaultControlOffset;
                break;
            default:
                targetControlX = targetX - defaultControlOffset;
                targetControlY = targetY;
        }
        
        return `M ${sourceX},${sourceY} 
                C ${sourceControlX},${sourceControlY} 
                  ${targetControlX},${targetControlY} 
                  ${targetX},${targetY}`;
    }
    
    // Add a label to a connection
    addConnectionLabel(connectionId, text) {
        const connection = this.findConnectionElement(connectionId);
        if (!connection) return;
        
        // Create a text element for the label
        const label = document.createElement('div');
        label.className = 'connection-label';
        label.dataset.connectionId = connectionId;
        label.textContent = text;
        
        // Position the label at the middle of the path
        const pathLength = connection.getTotalLength();
        const midPoint = connection.getPointAtLength(pathLength / 2);
        
        label.style.position = 'absolute';
        label.style.left = `${midPoint.x}px`;
        label.style.top = `${midPoint.y}px`;
        label.style.transform = 'translate(-50%, -50%)';
        
        // Add event listener for editing the label
        label.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (this.isEditing) return;
            
            // Make the label directly editable
            this.isEditing = true;
            label.contentEditable = true;
            label.classList.add('connection-label-editable');
            label.focus();
            
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(label);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Store original text for cancellation
            label.dataset.originalText = text;
            
            // Set up event listeners for saving
            const saveEdit = () => {
                if (!label.isConnected) return;
                
                const newText = label.textContent.trim();
                label.contentEditable = false;
                label.classList.remove('connection-label-editable');
                
                // Update connection data
                const connectionData = this.connections.find(c => c.id === connectionId);
                if (connectionData) {
                    connectionData.label = newText;
                }
                
                this.isEditing = false;
                
                // Update properties panel if this connection is selected
                if (this.selectedElement && this.selectedElement.dataset.id === connectionId) {
                    const labelInput = document.getElementById('prop-connection-label');
                    if (labelInput) {
                        labelInput.value = newText;
                    }
                }
            };
            
            // Save on blur
            label.addEventListener('blur', saveEdit, { once: true });
            
            // Save on Enter, cancel on Escape
            label.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    saveEdit();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    label.textContent = label.dataset.originalText || '';
                    label.contentEditable = false;
                    label.classList.remove('connection-label-editable');
                    this.isEditing = false;
                }
            });
        });
        
        this.canvas.appendChild(label);
    }
    
    // Update connection paths when nodes are moved
    updateConnections() {
        this.connections.forEach(conn => {
            const path = this.findConnectionElement(conn.id);
            const sourceNode = this.findNodeElement(conn.sourceId);
            const targetNode = this.findNodeElement(conn.targetId);
            
            if (!path || !sourceNode || !targetNode) return;
            
            // Get the specific connectors
            const sourceConnector = sourceNode.querySelector(`.connector[data-position="${conn.sourcePosition}"]`);
            const targetConnector = targetNode.querySelector(`.connector[data-position="${conn.targetPosition}"]`);
            
            if (!sourceConnector || !targetConnector) return;
            
            // Calculate connection points based on connector positions
            const sourceRect = sourceConnector.getBoundingClientRect();
            const targetRect = targetConnector.getBoundingClientRect();
            const canvasRect = this.canvas.getBoundingClientRect();
            
            const sourceX = (sourceRect.left + sourceRect.width / 2 - canvasRect.left) / this.scale;
            const sourceY = (sourceRect.top + sourceRect.height / 2 - canvasRect.top) / this.scale;
            const targetX = (targetRect.left + targetRect.width / 2 - canvasRect.left) / this.scale;
            const targetY = (targetRect.top + targetRect.height / 2 - canvasRect.top) / this.scale;
            
            // Update the path with the new connector positions
            const pathData = this.calculateConnectionPath(
                sourceX, sourceY, targetX, targetY,
                conn.sourcePosition, conn.targetPosition
            );
            
            path.setAttribute('d', pathData);
            
            // Update label position
            const label = document.querySelector(`.connection-label[data-connection-id="${conn.id}"]`);
            if (label) {
                const pathLength = path.getTotalLength();
                const midPoint = path.getPointAtLength(pathLength / 2);
                
                label.style.left = `${midPoint.x}px`;
                label.style.top = `${midPoint.y}px`;
            }
        });
    }
    
    // Delete selected element
    deleteSelected() {
        if (!this.selectedElement) return;
        
        if (this.selectedElement.classList && this.selectedElement.classList.contains('flow-node')) {
            this.deleteNode(this.selectedElement.dataset.id);
        } else if (this.selectedElement.classList && this.selectedElement.classList.contains('connection-line')) {
            this.deleteConnection(this.selectedElement.dataset.id);
        }
        
        this.selectedElement = null;
        this.updatePropertiesPanel();
    }
    
    // Delete a node and its connections
    deleteNode(nodeId) {
        // Remove node from DOM
        const nodeElement = this.findNodeElement(nodeId);
        if (nodeElement) nodeElement.remove();
        
        // Remove connections to/from this node
        const connectedPaths = Array.from(this.svg.querySelectorAll(`.connection-line[data-source-id="${nodeId}"], .connection-line[data-target-id="${nodeId}"]`));
        
        connectedPaths.forEach(path => {
            const connectionId = path.dataset.id;
            path.remove();
            
            // Remove connection labels
            const label = document.querySelector(`.connection-label[data-connection-id="${connectionId}"]`);
            if (label) label.remove();
            
            // Remove from connections array
            this.connections = this.connections.filter(conn => conn.id !== connectionId);
        });
        
        // Remove from nodes array
        this.nodes = this.nodes.filter(node => node.id !== nodeId);
    }
    
    // Delete a connection
    deleteConnection(connectionId) {
        // Remove connection path from DOM
        const path = this.findConnectionElement(connectionId);
        if (path) path.remove();
        
        // Remove connection label
        const label = document.querySelector(`.connection-label[data-connection-id="${connectionId}"]`);
        if (label) label.remove();
        
        // Remove from connections array
        this.connections = this.connections.filter(conn => conn.id !== connectionId);
    }
    
    // Clear all nodes and connections
    clearAll() {
        if (confirm('Are you sure you want to clear all elements?')) {
            // Remove all nodes
            this.nodes.forEach(node => {
                const nodeElement = this.findNodeElement(node.id);
                if (nodeElement) nodeElement.remove();
            });
            
            // Remove all connections
            this.connections.forEach(conn => {
                const path = this.findConnectionElement(conn.id);
                if (path) path.remove();
                
                const label = document.querySelector(`.connection-label[data-connection-id="${conn.id}"]`);
                if (label) label.remove();
            });
            
            // Reset arrays and counters
            this.nodes = [];
            this.connections = [];
            this.nextNodeId = 1;
            this.nextConnectionId = 1;
            this.selectedElement = null;
            this.lastNodePosition = { x: 100, y: 100 }; // Reset last node position
            
            this.updatePropertiesPanel();
        }
    }
    
    // Export the diagram as PNG
    exportAsPNG() {
        // First, hide any UI elements that shouldn't be in the export
        this.hideContextMenus();
        
        // Use html2canvas library (must be loaded in the HTML)
        /* 
        Note: This requires html2canvas library to be included in the HTML file:
        <script src="https://html2canvas.hertzen.com/dist/html2canvas.min.js"></script>
        */
        if (typeof html2canvas === 'undefined') {
            alert('html2canvas library is required for PNG export. Please add it to your HTML.');
            return;
        }
        
        html2canvas(this.canvas).then(canvas => {
            const link = document.createElement('a');
            link.download = 'flow-chart-export.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
    
    // Export the diagram as JSON
    exportAsJSON() {
        // Update nodes positions from the DOM
        this.nodes.forEach(node => {
            const nodeElement = this.findNodeElement(node.id);
            if (nodeElement) {
                node.x = parseInt(nodeElement.style.left);
                node.y = parseInt(nodeElement.style.top);
            }
        });
        
        const data = {
            nodes: this.nodes,
            connections: this.connections,
            nextNodeId: this.nextNodeId,
            nextConnectionId: this.nextConnectionId
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = 'flow-chart-data.json';
        link.href = url;
        link.click();
        
        URL.revokeObjectURL(url);
    }
    
    // Import diagram from JSON
    importFromJSON(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Clear current diagram
                this.clearAll();
                
                // Import nodes
                data.nodes.forEach(node => {
                    this.addNode(node.x, node.y, node.type, node.text);
                });
                
                // Import connections
                data.connections.forEach(conn => {
                    const path = this.createConnection(
                        conn.sourceId, 
                        conn.targetId, 
                        conn.sourcePosition || 'right', // Default for backward compatibility
                        conn.targetPosition || 'left',  // Default for backward compatibility
                        conn.label
                    );
                    
                    if (path) {
                        path.dataset.id = conn.id;
                    }
                });
                
                // Update counters
                this.nextNodeId = data.nextNodeId || this.nodes.length + 1;
                this.nextConnectionId = data.nextConnectionId || this.connections.length + 1;
                
                // Update last node position for next additions
                if (this.nodes.length > 0) {
                    const lastNode = this.nodes[this.nodes.length - 1];
                    this.lastNodePosition = { x: lastNode.x, y: lastNode.y };
                }
                
            } catch (error) {
                console.error('Error importing JSON:', error);
                alert('Error importing diagram. Invalid JSON format.');
            }
        };
        
        reader.readAsText(file);
        event.target.value = null; // Reset file input
    }
    
    // Handle mouse down on canvas
    handleCanvasMouseDown(e) {
        // Skip if we're editing text
        if (this.isEditing) return;
        
        const target = e.target.closest('.flow-node') || e.target;
        
        // Right-click for context menu
        if (e.button === 2) {
            if (target.classList.contains('flow-node') || target.closest('.flow-node')) {
                const nodeElement = target.closest('.flow-node') || target;
                this.showNodeContextMenu(e, nodeElement);
            } else if (target.classList.contains('connection-line') || target.classList.contains('connection-label')) {
                const connectionId = target.dataset.id || target.dataset.connectionId;
                this.showConnectionContextMenu(e, connectionId);
            }
            return;
        }
        
        // Left-click
        if (e.button === 0) {
            // Check if clicked on a connection line
            if (target.classList.contains('connection-line')) {
                this.deselectAll();
                target.classList.add('selected');
                this.selectedElement = target;
                this.updatePropertiesPanel();
                return;
            }
            
            // Check if clicked on a connector, which is handled by the connector's own mousedown
            if (target.classList.contains('connector')) {
                return;
            }
            
            // Handle node selection and dragging
            if (target.classList.contains('flow-node') || target.closest('.flow-node')) {
                const nodeElement = target.closest('.flow-node') || target;
                
                // Regular node selection - always select the node when clicked
                this.deselectAll();
                nodeElement.classList.add('selected');
                this.selectedElement = nodeElement;
                this.updatePropertiesPanel();
                
                // Prepare for dragging
                this.isDragging = true;
                const rect = nodeElement.getBoundingClientRect();
                this.dragOffsetX = e.clientX - rect.left;
                this.dragOffsetY = e.clientY - rect.top;
            } else {
                // Clicked on empty canvas
                this.deselectAll();
                this.updatePropertiesPanel();
            }
        }
    }
    
    // Handle mouse move on canvas
    handleCanvasMouseMove(e) {
        // Handle connection creation drag
        if (this.isCreatingConnection) {
            const canvasRect = this.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - canvasRect.left) / this.scale;
            const mouseY = (e.clientY - canvasRect.top) / this.scale;
            
            this.updateTempConnection(mouseX, mouseY);
            return;
        }
        
        // Handle node dragging
        if (this.isDragging && this.selectedElement) {
            const canvasRect = this.canvas.getBoundingClientRect();
            
            // Calculate new position with scale
            let x = (e.clientX - canvasRect.left - this.dragOffsetX) / this.scale;
            let y = (e.clientY - canvasRect.top - this.dragOffsetY) / this.scale;
            
            // Snap to grid if needed
            if (this.gridSize > 0) {
                x = Math.round(x / this.gridSize) * this.gridSize;
                y = Math.round(y / this.gridSize) * this.gridSize;
            }
            
            // Apply new position
            this.selectedElement.style.left = `${x}px`;
            this.selectedElement.style.top = `${y}px`;
            
            // Update node data
            const nodeId = this.selectedElement.dataset.id;
            const nodeData = this.nodes.find(n => n.id === nodeId);
            if (nodeData) {
                nodeData.x = x;
                nodeData.y = y;
            }
            
            // Update connections
            this.updateConnections();
            
            // Update properties panel if it's showing this node
            if (this.selectedElement === this.selectedElement) {
                const xInput = document.getElementById('prop-node-x');
                const yInput = document.getElementById('prop-node-y');
                if (xInput && yInput) {
                    xInput.value = x;
                    yInput.value = y;
                }
            }
        }
    }
    
    // Handle mouse up on canvas
    handleCanvasMouseUp(e) {
        this.isDragging = false;
        
        // Handle connection creation
        if (this.isCreatingConnection) {
            this.endConnectionDrag(e);
        }
    }
    
    // Show node context menu
    showNodeContextMenu(e, nodeElement) {
        e.preventDefault();
        
        this.selectedElement = nodeElement;
        this.updatePropertiesPanel();
        this.deselectAll();
        nodeElement.classList.add('selected');
        
        const rect = this.canvas.getBoundingClientRect();
        this.nodeContextMenu.style.left = `${e.clientX - rect.left}px`;
        this.nodeContextMenu.style.top = `${e.clientY - rect.top}px`;
        this.nodeContextMenu.style.display = 'block';
    }
    
    // Show connection context menu
    showConnectionContextMenu(e, connectionId) {
        e.preventDefault();
        
        const connection = this.findConnectionElement(connectionId);
        if (!connection) return;
        
        this.selectedElement = connection;
        this.deselectAll();
        connection.classList.add('selected');
        
        const rect = this.canvas.getBoundingClientRect();
        this.connectionContextMenu.style.left = `${e.clientX - rect.left}px`;
        this.connectionContextMenu.style.top = `${e.clientY - rect.top}px`;
        this.connectionContextMenu.style.display = 'block';
    }
    
    // Handle node context menu actions
    handleNodeContextMenu(e) {
        const action = e.target.dataset.action;
        const nodeId = this.selectedElement.dataset.id;
        
        if (!action || !nodeId) return;
        
        switch (action) {
            case 'edit':
                const nodeElement = this.findNodeElement(nodeId);
                if (nodeElement) {
                    const nodeContent = nodeElement.querySelector('.node-content');
                    if (nodeContent) {
                        this.makeNodeContentEditable(nodeElement, nodeContent);
                    }
                }
                break;
                
            case 'delete':
                this.deleteNode(nodeId);
                break;
                
            case 'start-connection':
                const nodeElement = this.findNodeElement(nodeId);
                if (nodeElement) {
                    // Default to right connector
                    const connector = nodeElement.querySelector('.connector[data-position="right"]');
                    if (connector) {
                        const rect = connector.getBoundingClientRect();
                        const fakeEvent = {
                            clientX: rect.left + rect.width / 2,
                            clientY: rect.top + rect.height / 2
                        };
                        this.startConnectionDrag(nodeId, 'right', fakeEvent);
                    }
                }
                break;
        }
        
        this.hideContextMenus();
    }
    
    // Handle connection context menu actions
    handleConnectionContextMenu(e) {
        const action = e.target.dataset.action;
        const connectionId = this.selectedElement.dataset.id;
        
        if (!action || !connectionId) return;
        
        switch (action) {
            case 'edit-label':
                const label = document.querySelector(`.connection-label[data-connection-id="${connectionId}"]`);
                if (label) {
                    // Trigger the inline editing logic by simulating a double-click
                    const dblClickEvent = new MouseEvent('dblclick', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    label.dispatchEvent(dblClickEvent);
                } else {
                    // If no label exists, create one with empty text
                    const connectionData = this.connections.find(c => c.id === connectionId);
                    if (connectionData) {
                        this.addConnectionLabel(connectionId, '');
                        
                        // Immediately trigger edit mode
                        setTimeout(() => {
                            const newLabel = document.querySelector(`.connection-label[data-connection-id="${connectionId}"]`);
                            if (newLabel) {
                                const dblClickEvent = new MouseEvent('dblclick', {
                                    bubbles: true,
                                    cancelable: true,
                                    view: window
                                });
                                newLabel.dispatchEvent(dblClickEvent);
                            }
                        }, 10);
                    }
                }
                break;
                
            case 'delete':
                this.deleteConnection(connectionId);
                break;
        }
        
        this.hideContextMenus();
    }
    
    // Hide all context menus
    hideContextMenus() {
        this.nodeContextMenu.style.display = 'none';
        this.connectionContextMenu.style.display = 'none';
    }
    
    // Update properties panel with selected element data
    updatePropertiesPanel() {
        this.propertiesContent.innerHTML = '';
        
        if (!this.selectedElement) {
            this.propertiesContent.innerHTML = '<p class="no-selection">Select an element to edit its properties</p>';
            return;
        }
        
        if (this.selectedElement.classList.contains('flow-node')) {
            const nodeId = this.selectedElement.dataset.id;
            const nodeData = this.nodes.find(n => n.id === nodeId);
            
            if (!nodeData) return;
            
            const nodeProps = document.createElement('div');
            nodeProps.innerHTML = `
                <div class="property-group">
                    <label>Node Type</label>
                    <select id="prop-node-type">
                        <option value="process" ${nodeData.type === 'process' ? 'selected' : ''}>Process</option>
                        <option value="decision" ${nodeData.type === 'decision' ? 'selected' : ''}>Decision</option>
                        <option value="start" ${nodeData.type === 'start' ? 'selected' : ''}>Start/End</option>
                        <option value="input" ${nodeData.type === 'input' ? 'selected' : ''}>Input/Output</option>
                    </select>
                </div>
                
                <div class="property-group">
                    <label>Node Text</label>
                    <input type="text" id="prop-node-text" value="${nodeData.text}">
                </div>
                
                <div class="property-group">
                    <label>Position</label>
                    <div style="display: flex; gap: 10px;">
                        <div style="flex: 1;">
                            <label>X</label>
                            <input type="number" id="prop-node-x" value="${parseInt(this.selectedElement.style.left)}">
                        </div>
                        <div style="flex: 1;">
                            <label>Y</label>
                            <input type="number" id="prop-node-y" value="${parseInt(this.selectedElement.style.top)}">
                        </div>
                    </div>
                </div>
            `;
            
            this.propertiesContent.appendChild(nodeProps);
            
            // Add event listeners for property changes
            document.getElementById('prop-node-type').addEventListener('change', (e) => {
                const newType = e.target.value;
                nodeData.type = newType;
                
                // Update node class
                this.selectedElement.className = `flow-node node-${newType}`;
                this.selectedElement.dataset.type = newType;
            });
            
            document.getElementById('prop-node-text').addEventListener('change', (e) => {
                const newText = e.target.value;
                nodeData.text = newText;
                
                const nodeContent = this.selectedElement.querySelector('.node-content');
                if (nodeContent) {
                    nodeContent.textContent = newText;
                }
            });
            
            document.getElementById('prop-node-x').addEventListener('change', (e) => {
                const newX = parseInt(e.target.value);
                this.selectedElement.style.left = `${newX}px`;
                this.updateConnections();
            });
            
            document.getElementById('prop-node-y').addEventListener('change', (e) => {
                const newY = parseInt(e.target.value);
                this.selectedElement.style.top = `${newY}px`;
                this.updateConnections();
            });
            
        } else if (this.selectedElement.classList.contains('connection-line')) {
            const connectionId = this.selectedElement.dataset.id;
            const connectionData = this.connections.find(c => c.id === connectionId);
            
            if (!connectionData) return;
            
            const connectionProps = document.createElement('div');
            connectionProps.innerHTML = `
                <div class="property-group">
                    <label>Connection Label</label>
                    <input type="text" id="prop-connection-label" value="${connectionData.label || ''}">
                </div>
                
                <div class="property-group">
                    <label>From Node</label>
                    <input type="text" value="Node ${connectionData.sourceId}" disabled>
                </div>
                
                <div class="property-group">
                    <label>To Node</label>
                    <input type="text" value="Node ${connectionData.targetId}" disabled>
                </div>
            `;
            
            this.propertiesContent.appendChild(connectionProps);
            
            // Add event listener for label change
            document.getElementById('prop-connection-label').addEventListener('change', (e) => {
                const newLabel = e.target.value;
                connectionData.label = newLabel;
                
                // Update or create label
                const labelElement = document.querySelector(`.connection-label[data-connection-id="${connectionId}"]`);
                if (labelElement) {
                    labelElement.textContent = newLabel;
                } else if (newLabel) {
                    this.addConnectionLabel(connectionId, newLabel);
                }
            });
        }
    }
    
    // Deselect all elements
    deselectAll() {
        document.querySelectorAll('.flow-node.selected, .connection-line.selected').forEach(element => {
            element.classList.remove('selected');
        });
    }
    
    // Find node element by ID
    findNodeElement(id) {
        return document.querySelector(`.flow-node[data-id="${id}"]`);
    }
    
    // Find connection element by ID
    findConnectionElement(id) {
        return document.querySelector(`.connection-line[data-id="${id}"]`);
    }
    
    // Zoom controls
    zoomIn() {
        this.scale = Math.min(2, this.scale + 0.1);
        this.applyZoom();
    }
    
    zoomOut() {
        this.scale = Math.max(0.5, this.scale - 0.1);
        this.applyZoom();
    }
    
    resetZoom() {
        this.scale = 1;
        this.applyZoom();
    }
    
    applyZoom() {
        this.canvas.style.transform = `scale(${this.scale})`;
        this.updateConnections();
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for html2canvas for export capability
    if (typeof html2canvas === 'undefined') {
        console.warn('html2canvas library not detected. PNG export will not work.');
        // Dynamically load html2canvas
        const script = document.createElement('script');
        script.src = 'https://html2canvas.hertzen.com/dist/html2canvas.min.js';
        document.head.appendChild(script);
    }
    
    window.flowChartApp = new FlowChartApp();
});
